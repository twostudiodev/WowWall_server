const { sendEmail } = require("../utils/helperFunctions");
const { success, error } = require("../utils/responseWrapper");

exports.submitResponseFromWebsite = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        if (!name || !email || !subject || !message || !phone) {
            return res.send(error(400, "All fields are required"));
        }


        const emailContent = `
        <h2>New Contact Form Submission From Two12 Website</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
        `;

        await sendEmail({
            to: 'connect@two12studio.com', // Replace with your Hostinger email
            from: process.env.HOSTINGER_EMAIL, // Replace with your Hostinger email
            subject: `Contact Form From Two12 Website: ${subject}`,
            html: emailContent,
        });

        return res.send(success(200, "Message sent successfully!"));
    }
    catch (e) {
        return res.send(error(500, e.message));
    }
}