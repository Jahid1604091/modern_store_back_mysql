"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert("companies", [
      {
        company_name: "WoodpackerSportswear",
        tag_line: "Quality Products, Trusted Service",
        logo: "/image/logo/logo.png",
        currency: "BDT",
        address: "311/B, Dhaka Housing, Adabar, Dhaka - 1217, Bangladesh",
        is_active: true,

        details:
          "WoodpackerSportswear is a modern jersey selling site, providing quality consumer products across Bangladesh with fast delivery and secure payment systems.",

        about_company:
          "Founded in 2020, WoopackerSportswear aims to simplify online shopping for customers by offering reliable products, transparent pricing, and responsive customer support.",

        no_customers: 12000,

        social_links: JSON.stringify([
          { name: "Facebook", icon: "FaFacebookF", url: "https://facebook.com/xyzltd" },
          { name: "LinkedIn", icon: "FaLinkedinIn", url: "https://linkedin.com/company/xyzltd" },
          { name: "X", icon: "FaXTwitter", url: "https://x.com/xyzltd" },
          { name: "YouTube", icon: "FaYoutube", url: "https://youtube.com/@xyzltd" },
          { name: "Instagram", icon: "FaInstagram", url: "https://instagram.com/xyzltd" },
        ]),

        payment_methods: JSON.stringify([
          { name: "Cash on Delivery", code: "cod", is_active: true },
          { name: "bKash", code: "bkash", is_active: true },
          { name: "Nagad", code: "nagad", is_active: true },
          { name: "Rocket", code: "rocket", is_active: false },
          { name: "Visa / MasterCard", code: "card", is_active: true },
        ]),

        contact: JSON.stringify({
          support_email: "support@xyzltd.com",
          contact_email: "info@xyzltd.com",
          support_mobile: "+8801700000000",
          contact_mobile: "+8801800000000",
        }),

        t_and_c:
          "By using our website, you agree to our terms and conditions including proper use of the platform, accurate information submission, and compliance with applicable laws.",

        privacy_policy:
          "We respect your privacy and ensure that your personal data is securely stored and never shared with unauthorized third parties.",

        faq: JSON.stringify([
          {
            question: "How long does delivery take?",
            answer: "Delivery usually takes 2-5 business days depending on your location.",
          },
          {
            question: "What payment methods are available?",
            answer: "We accept SSLCommerz payments including bKash, Nagad, Rocket, and major debit/credit cards.",
          },
          {
            question: "Can I return a product?",
            answer: "Yes, products can be returned within 7 days if they are unused and in original condition.",
          },
        ]),

        return_refund_policy:
          "Customers can request a return within 7 days of delivery. Refunds are processed after product inspection.",

        shipping_info:
          "We deliver all over Bangladesh. Inside Dhaka delivery charge is 60 BDT and outside Dhaka delivery charge is 120 BDT.",

        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("companies", { company_name: "WoodpackerSportswear" });
  },
};
