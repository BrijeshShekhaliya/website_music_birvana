import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import fs from "fs";
import path from "path";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET) {
  console.error("Missing R2 credentials in .env.local");
  process.exit(1);
}

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID,
    secretAccessKey: SECRET_ACCESS_KEY,
  },
});

const FOLDER_PREFIX = "Birvana aaplication/";

async function cleanOldUploads() {
  console.log(`Listing old apps in ${FOLDER_PREFIX}...`);
  const listCmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: FOLDER_PREFIX,
  });

  try {
    const listResponse = await s3.send(listCmd);
    if (listResponse.Contents && listResponse.Contents.length > 0) {
      const objectsToDelete = listResponse.Contents.map((obj) => ({ Key: obj.Key }));
      console.log(`Deleting ${objectsToDelete.length} old objects...`);
      
      const deleteCmd = new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: objectsToDelete },
      });
      
      await s3.send(deleteCmd);
      console.log("Old apps deleted successfully.");
    } else {
      console.log("No old apps found to delete.");
    }
  } catch (error) {
    console.error("Error cleaning old uploads:", error);
    throw error;
  }
}

async function uploadNewApp(apkPath) {
  if (!fs.existsSync(apkPath)) {
    console.error(`APK not found at path: ${apkPath}`);
    process.exit(1);
  }

  const fileStream = fs.createReadStream(apkPath);
  const fileName = "Birvana.apk";
  const objectKey = `${FOLDER_PREFIX}${fileName}`;

  console.log(`Uploading ${fileName} to R2...`);
  const putCmd = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    Body: fileStream,
    ContentType: "application/vnd.android.package-archive",
    ContentDisposition: `attachment; filename="${fileName}"`,
  });

  try {
    await s3.send(putCmd);
    console.log(`Successfully uploaded!`);
    console.log(`URL: ${process.env.R2_PUBLIC_BASE_URL}/${encodeURIComponent(FOLDER_PREFIX)}${encodeURIComponent(fileName)}`);
  } catch (error) {
    console.error("Error uploading new app:", error);
    throw error;
  }
}

async function main() {
  const apkPath = process.argv[2];
  if (!apkPath) {
    console.error("Usage: node scripts/upload-app.mjs <path-to-apk>");
    process.exit(1);
  }

  try {
    await cleanOldUploads();
    await uploadNewApp(apkPath);
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main();
