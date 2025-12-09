import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen page-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-4 border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Privacy Policy</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      {/* Content with side indicators */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />

        {/* Main Content */}
        <main className="flex-1 px-6 py-6 overflow-y-auto scrollbar-hide">
          <div className="max-w-3xl mx-auto">
          {/* Brand Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-3">
              <span className="text-4xl">🌾</span>
            </div>
            <h2 className="text-lg font-semibold mb-4">
              <span className="text-primary">Ask</span>
              <span className="text-farm-gold">My</span>
              <span className="text-primary">Farm</span>
            </h2>
          </div>
          
          <h1 className="text-2xl font-bold text-primary text-center mb-8">Privacy Policy</h1>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">1. Introduction</h2>
            <p className="body-text mb-4">
              LaNova AI Solutions LLC ("we," "us," or "our") operates AskMyFarm ("the Service"). 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
              when you use our farm management platform.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">2. Information We Collect</h2>
            
            <h3 className="text-base font-medium mb-2 mt-4 text-foreground">2.1 Personal Information</h3>
            <p className="body-text mb-4">
              We collect information you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>Name, email address, and phone number</li>
              <li>Farm name and location information</li>
              <li>Account credentials and authentication information</li>
              <li>Profile information and preferences</li>
            </ul>

            <h3 className="text-base font-medium mb-2 mt-4 text-foreground">2.2 Farm Data</h3>
            <p className="body-text mb-4">
              We collect and store data related to your farming operations, including:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>Field boundaries, plans, and prescriptions</li>
              <li>Scouting notes and observations</li>
              <li>Documents, photos, and voice recordings</li>
              <li>Task assignments and schedules</li>
              <li>Integration data from third-party services (e.g., John Deere Operations Center)</li>
            </ul>

            <h3 className="text-base font-medium mb-2 mt-4 text-foreground">2.3 Usage Information</h3>
            <p className="body-text mb-4">
              We automatically collect information about how you use the Service, including:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>Device information and IP address</li>
              <li>Browser type and version</li>
              <li>Pages visited and features used</li>
              <li>Time and date of access</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">3. How We Use Your Information</h2>
            <p className="body-text mb-4">We use the information we collect to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process transactions and send related information</li>
              <li>Send verification codes, notifications, and updates</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Monitor and analyze usage patterns and trends</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">4. Information Sharing and Disclosure</h2>
            <p className="body-text mb-4">
              We do not sell your personal information. We may share your information in the following circumstances:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>
                <strong>Service Providers:</strong> We may share information with third-party service providers 
                who perform services on our behalf (e.g., cloud storage, email delivery, SMS services)
              </li>
              <li>
                <strong>Third-Party Integrations:</strong> When you connect third-party services (e.g., John Deere), 
                we share necessary information to enable integration
              </li>
              <li>
                <strong>Legal Requirements:</strong> We may disclose information if required by law or to protect 
                our rights, property, or safety
              </li>
              <li>
                <strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale, your information 
                may be transferred as part of that transaction
              </li>
              <li>
                <strong>With Your Consent:</strong> We may share information with your explicit consent
              </li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">5. Data Security</h2>
            <p className="body-text mb-4">
              We implement appropriate technical and organizational measures to protect your information against 
              unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over 
              the Internet or electronic storage is 100% secure. While we strive to protect your information, we 
              cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">6. Data Retention</h2>
            <p className="body-text mb-4">
              We retain your information for as long as necessary to provide the Service and fulfill the purposes 
              outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. 
              When you delete your account, we will delete or anonymize your personal information, except where 
              we are required to retain it for legal or legitimate business purposes.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">7. Your Rights and Choices</h2>
            <p className="body-text mb-4">You have the right to:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>Access and review your personal information</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your personal information</li>
              <li>Opt-out of certain communications (e.g., marketing emails)</li>
              <li>Request a copy of your data in a portable format</li>
              <li>Withdraw consent where processing is based on consent</li>
            </ul>
            <p className="body-text mb-4">
              To exercise these rights, please contact us at contact@askmyfarm.us.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">8. SMS and Email Communications</h2>
            <p className="body-text mb-4">
              When you opt-in to receive SMS notifications, you consent to receive text messages from us. 
              Message and data rates may apply. You can opt-out at any time by replying STOP, END, QUIT, 
              CANCEL, UNSUBSCRIBE, or REVOKE to any message, or by disabling SMS notifications in your 
              account settings. For help, reply HELP or INFO.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">9. Children's Privacy</h2>
            <p className="body-text mb-4">
              The Service is not intended for individuals under the age of 18. We do not knowingly collect 
              personal information from children. If you believe we have collected information from a child, 
              please contact us immediately.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">10. Changes to This Privacy Policy</h2>
            <p className="body-text mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any material changes 
              by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage 
              you to review this Privacy Policy periodically.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">11. Contact Us</h2>
            <p className="body-text mb-4">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="body-text mb-2">
              <strong>Email:</strong> contact@askmyfarm.us
            </p>
            <p className="body-text mb-2">
              <strong>Website:</strong> https://www.askmyfarm.us
            </p>
          </section>
          </div>
        </main>

        {/* Right Mobile Indicator - Desktop Only */}
        <MobileFirstIndicator />
      </div>
    </div>
  );
}

