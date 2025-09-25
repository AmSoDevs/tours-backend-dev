"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteFromSpaces = exports.uploadToSpaces = void 0;
const aws_sdk_1 = __importDefault(require("aws-sdk"));
const dotenv_1 = __importDefault(require("dotenv"));
const _1 = require(".");
dotenv_1.default.config();
const spacesEndpoint = new aws_sdk_1.default.Endpoint('blr1.digitaloceanspaces.com');
const s3 = new aws_sdk_1.default.S3({
    endpoint: spacesEndpoint,
    accessKeyId: _1.config.spaces.accessKey,
    secretAccessKey: _1.config.spaces.secretKey,
    region: 'blr1'
});
const uploadToSpaces = async (file, folder = 'uploads') => {
    const fileName = `${folder}/${Date.now()}-${file.originalname}`;
    const uploadParams = {
        Bucket: _1.config.spaces.bucket,
        Key: fileName,
        Body: file.buffer,
        ACL: 'public-read',
        ContentType: file.mimetype
    };
    try {
        const result = await s3.upload(uploadParams).promise();
        return result.Location;
    }
    catch (error) {
        console.error('Error uploading to DigitalOcean Spaces:', error);
        throw new Error('Failed to upload image');
    }
};
exports.uploadToSpaces = uploadToSpaces;
const deleteFromSpaces = async (fileUrl) => {
    try {
        // Extract key from URL
        const url = new URL(fileUrl);
        const key = url.pathname.substring(1); // Remove leading slash
        const deleteParams = {
            Bucket: process.env.DO_SPACES_BUCKET || 'tours-malayali',
            Key: key
        };
        await s3.deleteObject(deleteParams).promise();
    }
    catch (error) {
        console.error('Error deleting from DigitalOcean Spaces:', error);
        throw new Error('Failed to delete image');
    }
};
exports.deleteFromSpaces = deleteFromSpaces;
exports.default = s3;
//# sourceMappingURL=spaces.js.map