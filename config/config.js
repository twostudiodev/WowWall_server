const {createClient} = require('@sanity/client')

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID, // Sanity project ID
  dataset: process.env.SANITY_DATASET, // Dataset (e.g., "production")
  token: process.env.SANITY_WRITE_TOKEN, // Write token (stored in .env)
  useCdn: false, // Disable CDN for write operations
  apiVersion : "2024-12-27"
});

module.exports = { client };
