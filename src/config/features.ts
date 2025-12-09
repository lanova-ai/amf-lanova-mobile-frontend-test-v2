/**
 * Feature flags for the AskMyFarm mobile app
 * 
 * These can be toggled to enable/disable features across the app.
 * Update these when features become available (e.g., A2P SMS approval).
 */

export const FEATURES = {
  /**
   * SMS Sharing Feature
   * 
   * Set to true when A2P 10DLC campaign is approved by Twilio.
   * When false, SMS option will be disabled on all share pages.
   * 
   * Status: PENDING APPROVAL
   * Last Updated: December 9, 2025
   */
  SMS_ENABLED: false,
  
  /**
   * SMS message to show when feature is disabled
   */
  SMS_DISABLED_MESSAGE: "SMS coming soon - pending carrier approval",
};

