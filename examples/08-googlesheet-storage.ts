import { Storage } from '@smythos/sdk';
import 'dotenv/config';

async function main() {
    // This example requires a .env file with the following content:
    // GOOGLE_CLIENT_ID=...
    // GOOGLE_CLIENT_SECRET=...
    // GOOGLE_REFRESH_TOKEN=...
    // GOOGLE_SHEET_ID=...

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN || !process.env.GOOGLE_SHEET_ID) {
        console.log('Please create a .env file with GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, and GOOGLE_SHEET_ID');
        return;
    }

    const googleSheetStorage = Storage.GoogleSheet({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        refreshToken: process.env.GOOGLE_REFRESH_TOKEN,
    });

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const range = 'Sheet1!A1:B2';
    const resourceId = `${spreadsheetId}/${range}`;

    const values = 'a,b\\nc,d';
    await googleSheetStorage.write(resourceId, Buffer.from(values));
    console.log(`Wrote "${values}" to ${resourceId}`);

    const data = await googleSheetStorage.read(resourceId);
    const dataAsString = data.toString();
    console.log(`Read "${dataAsString}" from ${resourceId}`);
}

main().catch(console.error);
