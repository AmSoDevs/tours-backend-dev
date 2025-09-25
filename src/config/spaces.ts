import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { config } from '.';

dotenv.config();
console.log('DO_SPACES_ACCESS_KEY:', config.spaces.accessKey );
console.log('DO_SPACES_SECRET_KEY:', config.spaces.secretKey );
console.log('DO_SPACES_BUCKET:',config.spaces.bucket );

const spacesEndpoint = new AWS.Endpoint('blr1.digitaloceanspaces.com');
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: config.spaces.accessKey,
  secretAccessKey: config.spaces.secretKey,
  region: 'blr1'
});

export const uploadToSpaces = async (
  file: Express.Multer.File,
  folder: string = 'uploads'
): Promise<string> => {
  const fileName = `${folder}/${Date.now()}-${file.originalname}`;
  
  const uploadParams = {
    Bucket: config.spaces.bucket,
    Key: fileName,
    Body: file.buffer,
    ACL: 'public-read',
    ContentType: file.mimetype
  };

  try {
    const result = await s3.upload(uploadParams).promise();
    return result.Location;
  } catch (error) {
    console.error('Error uploading to DigitalOcean Spaces:', error);
    throw new Error('Failed to upload image');
  }
};

export const deleteFromSpaces = async (fileUrl: string): Promise<void> => {
  try {
    // Extract key from URL
    const url = new URL(fileUrl);
    const key = url.pathname.substring(1); // Remove leading slash
    
    const deleteParams = {
      Bucket: process.env.DO_SPACES_BUCKET || 'tours-malayali',
      Key: key
    };

    await s3.deleteObject(deleteParams).promise();
  } catch (error) {
    console.error('Error deleting from DigitalOcean Spaces:', error);
    throw new Error('Failed to delete image');
  }
};

export default s3;
