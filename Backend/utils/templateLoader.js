// utils/templateLoader.js
const fs = require("fs");
const path = require("path");

const templates = {};

const getTemplatePath = (templateName) => {
  return path.join(__dirname, "..", "templates", `${templateName}.html`);
};

const getFallbackTemplate = () => {
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
};

const loadTemplate = (templateName) => {
  try {
    const templatePath = getTemplatePath(templateName);

    if (fs.existsSync(templatePath)) {
      return fs.readFileSync(templatePath, "utf8");
    } else {
      throw new Error(`Template ${templateName}.html not found`);
    }
  } catch (error) {
    return getFallbackTemplate();
  }
};

const renderTemplate = (templateName, variables = {}) => {
  let template = loadTemplate(templateName);

  Object.keys(variables).forEach((key) => {
    const placeholder = `{{${key}}}`;
    const value = variables[key] || "";
    template = template.split(placeholder).join(value);
  });

  return template;
};

module.exports = {
  loadTemplate,
  renderTemplate,
};
