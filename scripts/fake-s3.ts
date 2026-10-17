/**
 * Runs the in-memory S3 stand-in on a fixed port, for the e2e suite and for
 * local development without Docker:  npx tsx scripts/fake-s3.ts 3101
 */
import { startFakeS3 } from "../tests/support/fake-s3";

const port = Number(process.argv[2] ?? 3101);
startFakeS3(port).then((s3) => console.log(`fake S3 listening on ${s3.url}`));
