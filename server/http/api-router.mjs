import { handleAccountApi, isAccountApiRequest } from "../api/account-api.mjs";
import { handleAutomationApi, isAutomationApiRequest } from "../api/automation-api.mjs";
import { handleBookingApi, isBookingApiRequest } from "../api/booking-api.mjs";
import { handleBookingResourceApi, isBookingResourceApiRequest } from "../api/booking-resource-api.mjs";
import { handleBusinessApi, isBusinessApiRequest } from "../api/business-api.mjs";
import { handleBusinessUserAuthApi, isBusinessUserAuthApiRequest } from "../api/business-user-auth-api.mjs";
import { handleCampaignApi, isCampaignApiRequest } from "../api/campaign-api.mjs";
import { handleChannelApi, isChannelApiRequest } from "../api/channel-api.mjs";
import { handleCommerceApi, isCommerceApiRequest } from "../api/commerce-api.mjs";
import { handleCommunicationsApi, isCommunicationsApiRequest } from "../api/communications-api.mjs";
import { handleConsentApi, isConsentApiRequest } from "../api/consent-api.mjs";
import { handleContactApi, isContactApiRequest } from "../api/contact-api.mjs";
import { handleCrmConfigApi, isCrmConfigApiRequest } from "../api/crm-config-api.mjs";
import { handleCustomer360Api, isCustomer360ApiRequest } from "../api/customer-360-api.mjs";
import { handleDealApi, isDealApiRequest } from "../api/deal-api.mjs";
import { handleDemoPublishApi, isDemoPublishApiRequest } from "../api/demo-publish-api.mjs";
import { handleDiscoveryApi, isDiscoveryApiRequest } from "../api/discovery-api.mjs";
import { handleEventApi, isEventApiRequest } from "../api/event-api.mjs";
import { handleGoogleApi, isGoogleApiRequest } from "../api/google-api.mjs";
import { handleHealthApi, isHealthApiRequest } from "../api/health-api.mjs";
import { handleHospitalityApi, isHospitalityApiRequest } from "../api/hospitality-api.mjs";
import { handleInboxApi, isInboxApiRequest } from "../api/inbox-api.mjs";
import { handleIntelligenceApi, isIntelligenceApiRequest } from "../api/intelligence-api.mjs";
import { handleLoyaltyApi, isLoyaltyApiRequest } from "../api/loyalty-api.mjs";
import { handleMessageTemplateApi, isMessageTemplateApiRequest } from "../api/message-template-api.mjs";
import { handleMoneyApi, isMoneyApiRequest } from "../api/money-api.mjs";
import { handleOperationsApi, isOperationsApiRequest } from "../api/operations-api.mjs";
import { handleProposalApi, isProposalApiRequest } from "../api/proposal-api.mjs";
import { handleQaVisualApi, isQaVisualApiRequest } from "../api/qa-visual-api.mjs";
import { handleQuoteApi, isQuoteApiRequest } from "../api/quote-api.mjs";
import { handleReportApi, isReportApiRequest } from "../api/report-api.mjs";
import { handleReputationApi, isReputationApiRequest } from "../api/reputation-api.mjs";
import { handleSecurityApi, isSecurityApiRequest } from "../api/security-api.mjs";
import { handleSiteImageApi, isSiteImageApiRequest } from "../api/site-image-api.mjs";
import { handleStockImageApi, isStockImageApiRequest } from "../api/stock-image-api.mjs";
import { handleTaskApi, isTaskApiRequest } from "../api/task-api.mjs";
import { handleVerticalOperationsApi, isVerticalOperationsApiRequest } from "../api/vertical-operations-api.mjs";
import { handleZoneDiscoveryApi, isZoneDiscoveryApiRequest } from "../api/zone-discovery-api.mjs";
import { isAdminApiRequest, requireAdminApiAuth } from "../lib/admin-auth.mjs";
import { handleClientAuthApi, isClientAuthApiRequest } from "../lib/client-auth.mjs";

const publicRoutes = [
  route("stock-images", isStockImageApiRequest, handleStockImageApi),
  route("client-auth", isClientAuthApiRequest, handleClientAuthApi),
  route("business-user-auth", isBusinessUserAuthApiRequest, handleBusinessUserAuthApi),
  route(
    "public-booking-reminders",
    (pathname) => pathname.startsWith("/api/public/booking-reminders/")
      && isVerticalOperationsApiRequest(pathname),
    handleVerticalOperationsApi
  )
];

const protectedRoutes = [
  route("bookings", isBookingApiRequest, handleBookingApi),
  route("zone-discovery", isZoneDiscoveryApiRequest, handleZoneDiscoveryApi),
  route("security", isSecurityApiRequest, handleSecurityApi),
  route("booking-resources", isBookingResourceApiRequest, handleBookingResourceApi),
  route("accounts", isAccountApiRequest, handleAccountApi),
  route("automations", isAutomationApiRequest, handleAutomationApi),
  route("campaigns", isCampaignApiRequest, handleCampaignApi),
  route("commerce", isCommerceApiRequest, handleCommerceApi),
  route("crm-config", isCrmConfigApiRequest, handleCrmConfigApi),
  route("money", isMoneyApiRequest, handleMoneyApi),
  route("loyalty", isLoyaltyApiRequest, handleLoyaltyApi),
  route("intelligence", isIntelligenceApiRequest, handleIntelligenceApi),
  route("vertical-operations", isVerticalOperationsApiRequest, handleVerticalOperationsApi),
  route("quotes", isQuoteApiRequest, handleQuoteApi),
  route("consent", isConsentApiRequest, handleConsentApi),
  route("channels", isChannelApiRequest, handleChannelApi),
  route("customer-360", isCustomer360ApiRequest, handleCustomer360Api),
  route("google", isGoogleApiRequest, handleGoogleApi),
  route("message-templates", isMessageTemplateApiRequest, handleMessageTemplateApi),
  route("proposals", isProposalApiRequest, handleProposalApi),
  route("deals", isDealApiRequest, handleDealApi),
  route("tasks", isTaskApiRequest, handleTaskApi),
  route("communications", isCommunicationsApiRequest, handleCommunicationsApi),
  route("operations", isOperationsApiRequest, handleOperationsApi),
  route("hospitality", isHospitalityApiRequest, handleHospitalityApi),
  route("inbox", isInboxApiRequest, handleInboxApi),
  route("reports", isReportApiRequest, handleReportApi),
  route("reputation", isReputationApiRequest, handleReputationApi),
  route("visual-qa", isQaVisualApiRequest, handleQaVisualApi),
  route("site-images", isSiteImageApiRequest, handleSiteImageApi),
  route("demo-publish", isDemoPublishApiRequest, handleDemoPublishApi),
  route("events", isEventApiRequest, handleEventApi),
  route("contacts", isContactApiRequest, handleContactApi),
  route("discovery", isDiscoveryApiRequest, handleDiscoveryApi),
  route("businesses", isBusinessApiRequest, handleBusinessApi)
];

export const apiRouteManifest = Object.freeze({
  public: publicRoutes.map(({ name }) => name),
  protected: protectedRoutes.map(({ name }) => name)
});

export async function routeHealthRequest(request, response, context, pathname) {
  if (!isHealthApiRequest(pathname)) {
    return false;
  }

  await handleHealthApi(request, response, context);
  return true;
}

export async function routeApiRequest(request, response, context, pathname) {
  if (await dispatchFirst(publicRoutes, pathname, request, response, context)) {
    return true;
  }

  if (
    isAdminApiRequest(pathname)
    && !(await requireAdminApiAuth(request, response, context, pathname))
  ) {
    return true;
  }

  return dispatchFirst(protectedRoutes, pathname, request, response, context);
}

function route(name, matches, handle) {
  return Object.freeze({ name, matches, handle });
}

async function dispatchFirst(routes, pathname, request, response, context) {
  const match = routes.find((candidate) => candidate.matches(pathname));
  if (!match) {
    return false;
  }

  await match.handle(request, response, context);
  return true;
}
