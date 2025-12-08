import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MobileFirstIndicator } from "@/components/MobileFirstIndicator";

export default function Terms() {
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
        <h1 className="text-lg font-semibold">Terms of Service</h1>
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
          
          <h1 className="text-2xl font-bold text-primary text-center mb-8">Terms of Service</h1>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">1. Acceptance of Terms</h2>
            <p className="body-text mb-4">
              By accessing and using AskMyFarm ("the Service"), operated by LaNova AI Solutions LLC ("we," "us," or "our"), 
              you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">2. Description of Service</h2>
            <p className="body-text mb-4">
              AskMyFarm is a farm management platform that provides tools for field planning, scouting notes, 
              document management, voice recordings, and integration with third-party services such as John Deere Operations Center. 
              The Service helps farmers manage their agricultural operations more efficiently.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">3. User Accounts</h2>
            <p className="body-text mb-4">
              To use the Service, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Providing accurate and complete information when creating your account</li>
              <li>Notifying us immediately of any unauthorized use of your account</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">4. User Conduct</h2>
            <p className="body-text mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 body-text">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate any laws in your jurisdiction</li>
              <li>Transmit any viruses, malware, or harmful code</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use automated systems to access the Service without permission</li>
            </ul>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">5. Data and Content</h2>
            <p className="body-text mb-4">
              You retain ownership of all data and content you upload to the Service. By using the Service, you grant us 
              a license to store, process, and display your data as necessary to provide the Service. You are responsible 
              for ensuring you have the right to upload any content you provide.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">6. Third-Party Services</h2>
            <p className="body-text mb-4">
              The Service may integrate with third-party services, including but not limited to John Deere Operations Center. 
              Your use of third-party services is subject to their respective terms of service and privacy policies. 
              We are not responsible for the availability, accuracy, or content of third-party services.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">7. Service Availability</h2>
            <p className="body-text mb-4">
              We strive to provide reliable service but do not guarantee uninterrupted or error-free operation. 
              The Service may be temporarily unavailable due to maintenance, updates, or unforeseen circumstances. 
              We reserve the right to modify or discontinue the Service at any time.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">8. Limitation of Liability</h2>
            <p className="body-text mb-4">
              To the maximum extent permitted by law, LaNova AI Solutions LLC shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether 
              incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting 
              from your use of the Service.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">9. Indemnification</h2>
            <p className="body-text mb-4">
              You agree to indemnify and hold harmless LaNova AI Solutions LLC, its officers, directors, employees, 
              and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising 
              from your use of the Service or violation of these Terms.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">10. Modifications to Terms</h2>
            <p className="body-text mb-4">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email 
              or through the Service. Your continued use of the Service after such modifications constitutes acceptance 
              of the updated Terms.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">11. Termination</h2>
            <p className="body-text mb-4">
              We may terminate or suspend your account and access to the Service immediately, without prior notice, 
              for any reason, including breach of these Terms. Upon termination, your right to use the Service will 
              cease immediately.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">12. Governing Law</h2>
            <p className="body-text mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of Iowa, 
              United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-6">
            <h2 className="text-lg font-semibold mb-3 text-foreground">13. Contact Information</h2>
            <p className="body-text mb-4">
              If you have any questions about these Terms, please contact us at:
            </p>
            <p className="body-text mb-2">
              <strong>Email:</strong> contact@lanova.ai
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

