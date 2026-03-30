// Backend/services/emailService.js
const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  async sendVerificationEmail({ to, name, verificationUrl, webUrl }) {
    const mailOptions = {
      from: `"Univibe" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Verify Your Email - Univibe",
      html: this.generateVerificationEmailHTML({
        name,
        webUrl,
        verificationUrl,
      }),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      return false;
    }
  }

  generateVerificationEmailHTML({ name, webUrl, verificationUrl }) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email - Univibe</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
          
          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          }
          
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 48px 24px;
            text-align: center;
          }
          
          .logo {
            font-size: 32px;
            font-weight: 800;
            color: white;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
          }
          
          .tagline {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 500;
          }
          
          .content {
            padding: 40px 32px;
          }
          
          .greeting {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
            margin-bottom: 12px;
          }
          
          .message {
            color: #4b5563;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
          }
          
          .button-container {
            text-align: center;
            margin: 32px 0;
          }
          
          .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white !important;
            text-decoration: none !important;
            padding: 14px 32px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s ease, box-shadow 0.2s ease;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            cursor: pointer;
          }
          
          .verify-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          }
          
          .verify-link {
            text-decoration: none;
            display: inline-block;
          }
          
          .fallback-link {
            background-color: #f9fafb;
            border-radius: 12px;
            padding: 16px;
            margin: 24px 0;
            border: 1px solid #e5e7eb;
          }
          
          .fallback-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          
          .link {
            word-break: break-all;
            color: #667eea;
            text-decoration: none;
            font-size: 14px;
          }
          
          .info {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px;
            border-radius: 8px;
            margin: 24px 0;
          }
          
          .info-text {
            color: #92400e;
            font-size: 14px;
            margin: 0;
          }
          
          .footer {
            background-color: #f9fafb;
            padding: 24px 32px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          
          .footer-text {
            color: #9ca3af;
            font-size: 12px;
            margin: 0;
          }
          
          @media (max-width: 600px) {
            .content {
              padding: 32px 24px;
            }
            
            .greeting {
              font-size: 20px;
            }
            
            .verify-button {
              padding: 12px 28px;
              font-size: 14px;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div class="container">
          <div class="header">
            <div class="logo">UNIVIBE</div>
            <div class="tagline">Your Campus, Your Community, Your Vibe.</div>
          </div>
          
          <div class="content">
            <div class="greeting">Hello ${name}! 👋</div>
            <div class="message">
              Thank you for joining Univibe! We're excited to have you on board. 
              Please verify your email address to get started with your campus community.
            </div>
            
            <div class="button-container">
              <a href="${webUrl}" class="verify-button" style="color: white; text-decoration: none;">
                Verify Email Address
              </a>
            </div>
            
            <div class="button-container" style="margin-top: 16px;">
              <a href="${verificationUrl}" class="verify-button" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none;">
                Open in App
              </a>
            </div>
            
            <div class="fallback-link">
              <div class="fallback-label">Or copy and paste this link:</div>
              <a href="${webUrl}" class="link">${webUrl}</a>
            </div>
            
            <div class="info">
              <p class="info-text">
                ⏰ This verification link will expire in 24 hours. 
                If you didn't create this account, you can safely ignore this email.
              </p>
            </div>
          </div>
          
          <div class="footer">
            <p class="footer-text">
              © 2024 Univibe. All rights reserved.<br>
              Connecting students, building communities.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

module.exports = new EmailService();
