//==[ SRE: GoogleSheet ]======================

import { Logger } from '@sre/helpers/Log.helper';
import { StorageConnector } from '@sre/IO/Storage.service/StorageConnector';
import { ACL } from '@sre/Security/AccessControl/ACL.class';
import { IAccessCandidate, IACL, TAccessLevel, TAccessResult, TAccessRole } from '@sre/types/ACL.types';
import { StorageData, StorageMetadata } from '@sre/types/Storage.types';
import { AccessRequest } from '@sre/Security/AccessControl/AccessRequest.class';
import { SecureConnector } from '@sre/Security/SecureConnector.class';
import { google, Auth } from 'googleapis';

const console = Logger('GoogleSheet');

export type GoogleSheetConfig = {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
};

export class GoogleSheet extends StorageConnector {
    public name = 'GoogleSheet';
    private isInitialized = false;
    private oauth2Client: Auth.OAuth2Client;

    constructor(protected _settings?: GoogleSheetConfig) {
        super(_settings);
        if (!_settings?.clientId || !_settings?.clientSecret || !_settings?.refreshToken) {
            // SRE-GoogleSheet is disabled, this is not an error
            //throw new Error('GoogleSheet connector requires clientId, clientSecret, and refreshToken.');
        } else {
            this.initialize();
        }
    }

    private async initialize() {
        if (this._settings?.clientId && this._settings?.clientSecret && this._settings?.refreshToken) {
            this.oauth2Client = new google.auth.OAuth2(
                this._settings.clientId,
                this._settings.clientSecret
            );
            this.oauth2Client.setCredentials({
                refresh_token: this._settings.refreshToken,
            });
            this.isInitialized = true;
        }
    }

    private async getAccessToken() {
        if (!this.isInitialized || !this.oauth2Client) {
            throw new Error('GoogleSheet connector is not initialized.');
        }
        const { token } = await this.oauth2Client.getAccessToken();
        return token;
    }

    private parseResourceId(resourceId: string) {
        const parts = resourceId.split('/');
        if (parts.length < 2) { // allow for just spreadsheetId
            throw new Error('Invalid resourceId format for GoogleSheet. Expected <spreadsheet_id>/<sheet_name>!<range>');
        }
        const spreadsheetId = parts[0];
        const range = parts.slice(1).join('/'); // The rest is the range, which can contain slashes

        return { spreadsheetId, range };
    }

    @SecureConnector.AccessControl
    public async read(acRequest: AccessRequest, resourceId: string): Promise<StorageData> {
        if (!this.isInitialized) throw new Error('GoogleSheet connector is not initialized.');

        const { spreadsheetId, range } = this.parseResourceId(resourceId);
        const sheets = google.sheets('v4');

        try {
            const response = await sheets.spreadsheets.values.get({
                auth: this.oauth2Client,
                spreadsheetId,
                range,
            });

            const values = response.data.values;
            if (!values) {
                return Buffer.from('');
            }

            // Convert array of arrays to CSV string
            const csv = values.map(row => row.join(',')).join('\\n');
            return Buffer.from(csv);

        } catch (error) {
            console.error(`Error reading from GoogleSheet: ${error.message}`);
            throw error;
        }
    }

    private readonly METADATA_SHEET_NAME = '.metadata';

    @SecureConnector.AccessControl
    async getMetadata(acRequest: AccessRequest, resourceId: string): Promise<StorageMetadata | undefined> {
        if (!this.isInitialized) return undefined;

        const { spreadsheetId } = this.parseResourceId(resourceId);
        const sheets = google.sheets('v4');

        try {
            const response = await sheets.spreadsheets.values.get({
                auth: this.oauth2Client,
                spreadsheetId,
                range: `${this.METADATA_SHEET_NAME}!A:B`,
            });

            const rows = response.data.values;
            if (!rows) return undefined;

            const row = rows.find(r => r[0] === resourceId);
            if (row && row[1]) {
                return JSON.parse(row[1]);
            }
            return undefined;

        } catch (error) {
            if (error.code === 400 && error.message.includes('Unable to parse range')) {
                // This means the .metadata sheet doesn't exist
                return undefined;
            }
            console.error(`Error getting metadata from GoogleSheet: ${error.message}`);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async setMetadata(acRequest: AccessRequest, resourceId: string, metadata: StorageMetadata) {
        if (!this.isInitialized) return;

        const { spreadsheetId } = this.parseResourceId(resourceId);
        const sheets = google.sheets('v4');

        // First, try to get existing metadata to merge
        const existingMetadata = (await this.getMetadata(acRequest, resourceId)) || {};
        const newMetadata = { ...existingMetadata, ...metadata };
        const metadataJson = JSON.stringify(newMetadata);

        try {
            // Try to update existing metadata first
            const getResponse = await sheets.spreadsheets.values.get({
                auth: this.oauth2Client,
                spreadsheetId,
                range: `${this.METADATA_SHEET_NAME}!A:A`,
            });

            const rows = getResponse.data.values;
            const rowIndex = rows ? rows.findIndex(r => r[0] === resourceId) : -1;

            if (rowIndex !== -1) {
                // Update existing row
                await sheets.spreadsheets.values.update({
                    auth: this.oauth2Client,
                    spreadsheetId,
                    range: `${this.METADATA_SHEET_NAME}!B${rowIndex + 1}`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [[metadataJson]],
                    },
                });
            } else {
                // Append new row
                await sheets.spreadsheets.values.append({
                    auth: this.oauth2Client,
                    spreadsheetId,
                    range: `${this.METADATA_SHEET_NAME}!A:B`,
                    valueInputOption: 'RAW',
                    requestBody: {
                        values: [[resourceId, metadataJson]],
                    },
                });
            }
        } catch (error) {
            if (error.code === 400 && error.message.includes('Unable to parse range')) {
                // This means the .metadata sheet doesn't exist, so we create it and add the metadata
                await this.createMetadataSheetAndAddMetadata(spreadsheetId, resourceId, metadataJson);
                return;
            }
            console.error(`Error setting metadata in GoogleSheet: ${error.message}`);
            throw error;
        }
    }

    private async createMetadataSheetAndAddMetadata(spreadsheetId: string, resourceId: string, metadataJson: string) {
        const sheets = google.sheets('v4');
        try {
            // Create the .metadata sheet
            await sheets.spreadsheets.batchUpdate({
                auth: this.oauth2Client,
                spreadsheetId,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: {
                                title: this.METADATA_SHEET_NAME,
                                hidden: true,
                            }
                        }
                    }]
                }
            });

            // Add the metadata
            await sheets.spreadsheets.values.append({
                auth: this.oauth2Client,
                spreadsheetId,
                range: `${this.METADATA_SHEET_NAME}!A:B`,
                valueInputOption: 'RAW',
                requestBody: {
                    values: [[resourceId, metadataJson]],
                },
            });

        } catch (error) {
            console.error(`Error creating metadata sheet: ${error.message}`);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async write(acRequest: AccessRequest, resourceId: string, value: StorageData, acl?: IACL, metadata?: StorageMetadata): Promise<void> {
        if (!this.isInitialized) throw new Error('GoogleSheet connector is not initialized.');

        const { spreadsheetId, range } = this.parseResourceId(resourceId);
        const sheets = google.sheets('v4');

        // Convert CSV string to array of arrays
        const csv = value.toString();
        const values = csv.split('\\n').map(row => row.split(','));

        try {
            await sheets.spreadsheets.values.update({
                auth: this.oauth2Client,
                spreadsheetId,
                range,
                valueInputOption: 'RAW',
                requestBody: {
                    values,
                },
            });
        } catch (error) {
            console.error(`Error writing to GoogleSheet: ${error.message}`);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async delete(acRequest: AccessRequest, resourceId: string): Promise<void> {
        if (!this.isInitialized) return;

        try {
            const { spreadsheetId, range } = this.parseResourceId(resourceId);
            const sheets = google.sheets('v4');

            await sheets.spreadsheets.values.clear({
                auth: this.oauth2Client,
                spreadsheetId,
                range,
            });
        } catch (error) {
            console.error(`Error deleting from GoogleSheet: ${error.message}`);
            throw error;
        }
    }

    @SecureConnector.AccessControl
    async exists(acRequest: AccessRequest, resourceId: string): Promise<boolean> {
        if (!this.isInitialized) return false;

        try {
            const { spreadsheetId, range } = this.parseResourceId(resourceId);
            const sheets = google.sheets('v4');

            // First, check if the spreadsheet exists
            await sheets.spreadsheets.get({
                auth: this.oauth2Client,
                spreadsheetId,
            });

            // Then, check if the range is valid by trying to read it
            await sheets.spreadsheets.values.get({
                auth: this.oauth2Client,
                spreadsheetId,
                range,
            });

            return true;
        } catch (error) {
            // If the error is a 404, it means the sheet or range doesn't exist.
            if (error.code === 404) {
                return false;
            }
            // For other errors, we rethrow them.
            console.error(`Error checking existence in GoogleSheet: ${error.message}`);
            throw error;
        }
    }

    public async getResourceACL(resourceId: string, candidate: IAccessCandidate): Promise<ACL> {
        // ACL methods are not implemented for the GoogleSheet connector.
        // Mapping the internal ACL system to Google's permission model is a complex task
        // that is out of the scope of the current implementation.
        console.warn(`GoogleSheet.getResourceACL is not implemented yet.`);
        return new ACL().addAccess(candidate.role, candidate.id, TAccessLevel.Owner);
    }

    @SecureConnector.AccessControl
    async getACL(acRequest: AccessRequest, resourceId: string): Promise<ACL | undefined> {
        // ACL methods are not implemented for the GoogleSheet connector.
        // Mapping the internal ACL system to Google's permission model is a complex task
        // that is out of the scope of the current implementation.
        console.warn(`GoogleSheet.getACL is not implemented yet.`);
        return undefined;
    }

    @SecureConnector.AccessControl
    async setACL(acRequest: AccessRequest, resourceId: string, acl: IACL) {
        // ACL methods are not implemented for the GoogleSheet connector.
        // Mapping the internal ACL system to Google's permission model is a complex task
        // that is out of the scope of the current implementation.
        console.warn(`GoogleSheet.setACL is not implemented yet.`);
    }

    @SecureConnector.AccessControl
    async expire(acRequest: AccessRequest, resourceId: string, ttl: number) {
        console.warn(`GoogleSheet.expire is not implemented for this connector.`);
    }
}
