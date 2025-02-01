const mongoose = require('mongoose')

module.exports = async () => {
  try {
    const connect = await mongoose.connect(process.env.MONGO_URI)
    console.log(`MongoDB connected: ${connect.connection.host}`)
  } catch (e) {
    console.log('Error while connecting to mongo', e)
    process.exit(1)
  }
}
