import {
  ConsentOptionCreate,
  PrivacyNoticeResponseWithUserPreferences,
} from "~/types/api";
import { CONSENT_COOKIE_NAME, FidesCookie } from "fides-js";
import { API_URL } from "../support/constants";

const VERIFICATION_CODE = "112358";
const PRIVACY_NOTICE_ID_1 = "pri_b4360591-3cc7-400d-a5ff-a9f095ab3061";
const PRIVACY_NOTICE_ID_2 = "pri_b558ab1f-5367-4f0d-94b1-ec06a81ae821";
const PRIVACY_NOTICE_ID_3 = "pri_4bed96d0-b9e3-4596-a807-26b783836375";
const PRIVACY_EXPERIENCE_ID = "pri_041acb07-c99b-4085-a435-c0d6f3a42b6f";
const GEOLOCATION_API_URL = "https://www.example.com/location";
const SETTINGS = {
  IS_OVERLAY_ENABLED: true,
  IS_GEOLOCATION_ENABLED: true,
  GEOLOCATION_API_URL,
};

describe("Privacy notice driven consent", () => {
  beforeEach(() => {
    // Seed local storage with verification data
    cy.window().then((win) => {
      win.localStorage.setItem(
        "consentRequestId",
        JSON.stringify("consent-request-id")
      );
      win.localStorage.setItem(
        "verificationCode",
        JSON.stringify(VERIFICATION_CODE)
      );
    });

    // Intercept sending identity data to the backend to access /consent page
    cy.intercept(
      "POST",
      `${API_URL}/consent-request/consent-request-id/verify`,
      { fixture: "consent/verify" }
    ).as("postConsentRequestVerify");

    // Location intercept
    cy.intercept("GET", GEOLOCATION_API_URL, {
      fixture: "consent/geolocation.json",
    }).as("getGeolocation");

    // Experience intercept
    cy.intercept("GET", `${API_URL}/privacy-experience/*`, {
      fixture: "consent/experience.json",
    }).as("getExperience");

    // Patch privacy preference intercept
    cy.intercept(
      "PATCH",
      `${API_URL}/consent-request/consent-request-id/privacy-preferences*`,
      {
        fixture: "consent/privacy_preferences.json",
      }
    ).as("patchPrivacyPreference");
  });

  describe("when user has not consented before", () => {
    beforeEach(() => {
      cy.visit("/consent");
      cy.getByTestId("consent");
      cy.overrideSettings(SETTINGS);
    });

    it("populates its header from the experience config", () => {
      cy.wait("@getExperience");
      cy.getByTestId("consent-heading").contains("Privacy notice driven");
      cy.getByTestId("consent-description").contains(
        "Manage all of your notices here."
      );
    });

    it("renders from privacy notices when there is no initial data", () => {
      cy.wait("@getExperience").then((interception) => {
        const { url } = interception.request;
        expect(url).contains("fides_user_device_id");
        expect(url).contains("region=us_ca");
      });
      // Opt in, so should default to not checked
      cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_1}`).within(() => {
        cy.getRadio().should("not.be.checked");
      });
      // Opt out, so should default to checked
      cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_2}`).within(() => {
        cy.getRadio().should("be.checked");
      });
      // Notice only, so should be checked and disabled
      cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_3}`).within(() => {
        cy.getRadio().should("be.checked").should("be.disabled");
      });

      // Opt in to the opt in notice
      cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_1}`).within(() => {
        cy.getRadio().should("not.be.checked").check({ force: true });
        cy.getRadio().should("be.checked");
      });

      cy.getByTestId("save-btn").click();
      cy.wait("@patchPrivacyPreference").then((interception) => {
        const { body } = interception.request;
        const { preferences, code, method, privacy_experience_id: id } = body;
        expect(method).to.eql("button");
        expect(code).to.eql(VERIFICATION_CODE);
        expect(id).to.eql(PRIVACY_EXPERIENCE_ID);
        expect(
          preferences.map((p: ConsentOptionCreate) => p.preference)
        ).to.eql(["opt_in", "opt_in", "acknowledge"]);
        // Should update the cookie
        cy.waitUntilCookieExists(CONSENT_COOKIE_NAME).then(() => {
          cy.getCookie(CONSENT_COOKIE_NAME).then((cookieJson) => {
            const cookie = JSON.parse(
              decodeURIComponent(cookieJson!.value)
            ) as FidesCookie;
            expect(body.browser_identity.fides_user_device_id).to.eql(
              cookie.identity.fides_user_device_id
            );
            const expectedConsent = { data_sales: true, advertising: true };
            const { consent } = cookie;
            expect(consent).to.eql(expectedConsent);
            // Should update the window object
            cy.window().then((win) => {
              expect(win.Fides.consent).to.eql(expectedConsent);
            });
          });
        });
      });
    });

    it("uses the device id found in an already existing cookie", () => {
      const uuid = "4fbb6edf-34f6-4717-a6f1-541fd1e5d585";
      const createdAt = "2023-04-28T12:00:00.000Z";
      const updatedAt = "2023-04-29T12:00:00.000Z";
      const cookie = {
        identity: { fides_user_device_id: uuid },
        fides_meta: { version: "0.9.0", createdAt, updatedAt },
        consent: {},
      };
      cy.setCookie(CONSENT_COOKIE_NAME, JSON.stringify(cookie));

      cy.wait("@getExperience").then((interception) => {
        const { url } = interception.request;
        expect(url).contains(`fides_user_device_id=${uuid}`);
      });
      // Make sure the same uuid propagates to the backend and to the updated cookie
      cy.getByTestId("save-btn").click();
      cy.wait("@patchPrivacyPreference").then((interception) => {
        const { body } = interception.request;
        cy.getCookie(CONSENT_COOKIE_NAME).then((cookieJson) => {
          const savedCookie = JSON.parse(
            decodeURIComponent(cookieJson!.value)
          ) as FidesCookie;
          expect(body.browser_identity.fides_user_device_id).to.eql(
            savedCookie.identity.fides_user_device_id
          );
        });
      });
    });

    describe("cookie enforcement", () => {
      beforeEach(() => {
        // First seed the browser with the cookies that are listed in the notices
        cy.fixture("consent/experience.json").then((data) => {
          const notices: PrivacyNoticeResponseWithUserPreferences[] =
            data.items[0].privacy_notices;

          const allCookies = notices.map((notice) => notice.cookies).flat();
          allCookies.forEach((cookie) => {
            cy.setCookie(cookie.name, "value", {
              path: cookie.path ?? "/",
              domain: cookie.domain ?? undefined,
            });
          });
          cy.getAllCookies().then((cookies) => {
            expect(
              cookies.filter((c) => c.name !== CONSENT_COOKIE_NAME).length
            ).to.eql(allCookies.length);
          });
          cy.wrap(notices).as("notices");
        });
      });

      it("can delete all cookies for when opting out of all notices", () => {
        // Opt out of the opt-out notice
        cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_2}`).within(() => {
          cy.getRadio().should("be.checked");
          cy.get("span").contains("No").click();
        });
        cy.getByTestId("save-btn").click();

        cy.wait("@patchPrivacyPreference").then(() => {
          // Use waitUntil to help with CI
          cy.waitUntil(() =>
            cy.getAllCookies().then((cookies) => cookies.length === 1)
          ).then(() => {
            // There should be no cookies related to the privacy notices around
            cy.getAllCookies().then((cookies) => {
              const filteredCookies = cookies.filter(
                (c) => c.name !== CONSENT_COOKIE_NAME
              );
              expect(filteredCookies.length).to.eql(0);
            });
          });
        });
      });

      it("can delete only the cookies associated with opt-out notices", () => {
        // Opt into first notice
        cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_1}`).within(() => {
          cy.get("span").contains("Yes").click();
        });
        // Opt out of second notice
        cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_2}`).within(() => {
          cy.getRadio().should("be.checked");
          cy.get("span").contains("No").click();
        });
        cy.getByTestId("save-btn").click();

        cy.wait("@patchPrivacyPreference").then(() => {
          // Use waitUntil to help with CI
          cy.waitUntil(() =>
            cy.getAllCookies().then((cookies) => cookies.length === 2)
          ).then(() => {
            // The first notice's cookies should still be around
            // But there should be none of the second cookie's
            cy.getAllCookies().then((cookies) => {
              const filteredCookies = cookies.filter(
                (c) => c.name !== CONSENT_COOKIE_NAME
              );
              expect(filteredCookies.length).to.eql(1);
              cy.get("@notices").then((notices: any) => {
                expect(filteredCookies[0]).to.have.property(
                  "name",
                  notices[0].cookies[0].name
                );
              });
            });
          });
        });
      });

      it("can successfully delete even if cookie does not exist", () => {
        cy.clearAllCookies();
        // Opt out of second notice
        cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_2}`).within(() => {
          cy.getRadio().should("be.checked");
          cy.get("span").contains("No").click();
        });
        cy.getByTestId("save-btn").click();

        cy.wait("@patchPrivacyPreference").then(() => {
          cy.getAllCookies().then((cookies) => {
            const filteredCookies = cookies.filter(
              (c) => c.name !== CONSENT_COOKIE_NAME
            );
            expect(filteredCookies.length).to.eql(0);
          });
        });
      });
    });
  });

  describe("when user has consented before", () => {
    it("renders from privacy notices when user has consented before", () => {
      cy.fixture("consent/experience.json").then((experience) => {
        const newExperience = { ...experience };
        const notices = newExperience.items[0].privacy_notices;
        newExperience.items[0].privacy_notices = notices.map(
          (notice: PrivacyNoticeResponseWithUserPreferences) => ({
            ...notice,
            ...{ current_preference: "opt_in" },
          })
        );
        cy.intercept("GET", `${API_URL}/privacy-experience/*`, {
          body: newExperience,
        }).as("getExperienceWithConsentHistory");
      });
      // Visit the consent page with notices enabled
      cy.visit("/consent");
      cy.getByTestId("consent");
      cy.overrideSettings(SETTINGS);
      // Both notices should be checked
      cy.wait("@getExperienceWithConsentHistory");
      cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_1}`).within(() => {
        cy.getRadio().should("be.checked");
      });
      cy.getByTestId(`consent-item-${PRIVACY_NOTICE_ID_2}`).within(() => {
        cy.getRadio().should("be.checked");
      });

      cy.getByTestId("save-btn").click();
      cy.wait("@patchPrivacyPreference").then((interception) => {
        const { body } = interception.request;
        const { preferences } = body;
        expect(
          preferences.map((p: ConsentOptionCreate) => p.preference)
        ).to.eql(["opt_in", "opt_in", "acknowledge"]);
      });
    });
  });
});