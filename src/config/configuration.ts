export default () => ({
    port: parseInt(process.env.PORT || '3000', 10),
    database: {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        name: process.env.DB_NAME,
        synchronize: process.env.NODE_ENV !== 'production',
    },
    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '86400', 10),
    },
    aws: {
        region: process.env.AWS_REGION || 'ap-south-1',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        mockMode: process.env.AWS_MOCK_MODE || 'true',
        subnetId: process.env.AWS_SUBNET_ID,
        securityGroupId: process.env.AWS_SECURITY_GROUP_ID,
        amiId: process.env.AWS_AMI_ID,
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
    encryptionKey: process.env.ENCRYPTION_KEY,
});