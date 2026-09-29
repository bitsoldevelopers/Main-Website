/* ============================================================
   BITSOL MARKETING — Chatbot Configuration
   Edit these values, then reload the page. No build step needed.
   ============================================================ */

window.BITSOL_CONFIG = {
  // Company
  companyName: "BITSOL MARKETING Pvt. Ltd.",

  // WhatsApp handover number (wa.me link is built from this)
  whatsappNumber: "923103175175",

  /* Google Sheets endpoint.
     Paste the URL of your deployed Google Apps Script Web App here.
     See apps-script/Code.gs and the README for the 5-minute setup.
     While this is empty, the bot still works fully — leads are stored
     locally in the browser and a Lead ID is generated on-device so you
     can preview the whole flow before connecting the sheet. */
  sheetsWebAppUrl: "",

  // Assigned-To routing by branch (used in the CRM record)
  assignedToByBranch: {
    "Lahore Head Office": "Lahore Admissions Team",
    "Islamabad Office": "Islamabad Admissions Team",
    "Faisalabad Branch": "Faisalabad Admissions Team",
    "Sahiwal Branch": "Sahiwal Admissions Team",
    "Samundri Branch": "Samundri Admissions Team",
  },
};
