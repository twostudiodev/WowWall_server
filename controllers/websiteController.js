const { sendEmail, generateEmailTemplate } = require("../utils/helperFunctions");
const { success, error } = require("../utils/responseWrapper");
const FailedEmail = require("../models/FailedEmail");

const { authorizedDomains } = require("../config/details");

exports.submitResponseFromWebsite = async (req, res) => {
    try {
        const { name, email, phone, subject, message, website } = req.body;

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
            subject: `Contact Form From Two12 Website: ${subject}`,
            html: emailContent,
        });

        return res.send(success(200, "Message sent successfully!"));
    }
    catch (e) {
        return res.send(error(500, e.message));
    }
}


exports.sendEmailFromWebsite = async (req, res) => {
    try {
        const { website, subject, ...formData } = req.body;

        console.log(formData);

        if (!formData || !website || !subject) {
            return res.status(400).json({ error: "All fields are required!" });
        }

        const adminEmail = authorizedDomains[website];

        if (!adminEmail) {
            return res.status(404).send(error(404, "This Domain is Not Authorized yet!!"));
        }


        // const emailContent = `
        // <h2>New Contact Form Submission From ${website} Website</h2>
        // <p><strong>Name:</strong> ${name}</p>
        // <p><strong>Email:</strong> ${email}</p>
        // <p><strong>Subject:</strong> ${subject}</p>
        // <p><strong>Phone:</strong> ${phone}</p>
        // <p><strong>Message:</strong></p>
        // <p>${message}</p>
        // `;

        const emailContent = generateEmailTemplate(formData, website, subject);


        try {
            await sendEmail({
                to: adminEmail,
                subject: `Contact Form From ${website} Website: ${subject}`,
                html: emailContent
            });

            console.log(`Email Send Succesfully to ${adminEmail}`);


            return res.json(success(200, "Your Message Has Been Sent!"));

        } catch (e) {
            console.error(`❌ Email sending failed: ${e.message}`);

            await FailedEmail.create({
                to: adminEmail,
                subject: `Contact Form From ${website} Website: ${subject}`,
                website : website,
                data: formData,
                attempts: 0
            })

            return res.status(500).json(error(201, "Your Response Has Been Recorded."));
        }

    } catch (e) {
        console.log("Error Occured in sendEmailFromWebsite ", e.message);
        return res.send(error(500, "Something went wrong"));
    }
}