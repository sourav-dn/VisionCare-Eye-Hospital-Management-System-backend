const mongoose = require('mongoose');
const dns = require('dns');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB connected: ${conn.connection.host} (DB: ${conn.connection.name})`);
  } catch (error) {
    if (error.message.includes('querySrv ECONNREFUSED')) {
      console.warn('⚠️ Local DNS failed SRV lookup. Retrying with Google/Cloudflare DNS (8.8.8.8, 1.1.1.1)...');
      try {
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        const conn = await mongoose.connect(process.env.MONGO_URI, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB connected: ${conn.connection.host} (DB: ${conn.connection.name})`);
        return;
      } catch (dnsErr) {
        console.error(`❌ MongoDB connection failed after DNS fallback: ${dnsErr.message}`);
      }
    } else {
      console.error(`❌ MongoDB connection failed: ${error.message}`);
    }
    process.exit(1);
  }
};

module.exports = connectDB;
