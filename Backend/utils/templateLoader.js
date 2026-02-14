// utils/templateLoader.js - Make sure this file exists
const fs = require('fs');
const path = require('path');

const templates = {};

const loadTemplate = (templateName) => {
  try {
    const templatePath = path.join(__dirname, '..', 'templates', `${templateName}.html`);
    
    if (fs.existsSync(templatePath)) {
      console.log(`✅ Loading template from: ${templatePath}`);
      return fs.readFileSync(templatePath, 'utf8');
    } else {
      console.error(`❌ Template not found at: ${templatePath}`);
      throw new Error(`Template ${templateName}.html not found`);
    }
  } catch (error) {
    console.error('Error loading template:', error);
    // Fallback template
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>UNIVIBE - Email Verification</title>
        <style>
          body { 
            font-family: sans-serif; 
            padding: 40px; 
            text-align: center; 
            background: #f5f5f5;
          }
          .container { max-width: 500px; margin: 0 auto; }
          h1 { color: #6C63FF; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>UNIVIBE - Email Verification</h1>
          <p>Loading verification...</p>
        </div>
      </body>
      </html>
    `;
  }
};

const renderTemplate = (templateName, variables = {}) => {
  console.log(`🎨 Rendering template: ${templateName}`);
  let template = loadTemplate(templateName);
  
  // Replace variables in template
  Object.keys(variables).forEach(key => {
    const placeholder = `{{${key}}}`;
    const value = variables[key] || '';
    template = template.split(placeholder).join(value);
  });

  return template;
};

// Make sure these are exported
module.exports = { 
  loadTemplate, 
  renderTemplate 
};