import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import path from "path";
import fs from "fs";

const USE_R2 = !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY);
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "photos");

let s3: S3Client | null = null;

if (USE_R2) {
  s3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  console.log("[r2] Cloudflare R2 storage enabled");
} else {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  console.log("[r2] Using local file storage (set R2_* env vars for Cloudflare R2)");
}

const BUCKET = process.env.R2_BUCKET_NAME || "buildflow-photos";
const PUBLIC_URL = process.env.R2_PUBLIC_URL || "";

export function isR2Enabled() {
  return USE_R2;
}

export async function uploadFile(fileName: string, buffer: Buffer, contentType: string): Promise<string> {
  if (USE_R2 && s3) {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: fileName,
      Body: buffer,
      ContentType: contentType,
    }));
    return PUBLIC_URL ? `${PUBLIC_URL}/${fileName}` : `/api/photos/file/${fileName}`;
  } else {
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/photos/${fileName}`;
  }
}

export async function getFileBuffer(fileName: string): Promise<Buffer | null> {
  if (USE_R2 && s3) {
    try {
      const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: fileName }));
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  } else {
    const filePath = path.join(UPLOAD_DIR, fileName);
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath);
    return null;
  }
}

export async function getFileStream(key: string) {
  if (USE_R2 && s3) {
    const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    return response.Body;
  }
  return null;
}
