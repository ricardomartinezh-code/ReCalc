import assert from "node:assert/strict";
import test from "node:test";
import {
  UNIVERSITY_DOMAINS as API_UNIVERSITY_DOMAINS,
  isAllowedDomain as isAllowedApiDomain,
} from "../api/auth/config";
import { UNIVERSITY_DOMAINS as UI_UNIVERSITY_DOMAINS } from "../src/data/authConfig";
import { isAllowedDomain as isAllowedUiDomain } from "../src/utils/auth";

const allowed = [
  "unidep.mx",
  "unidep.edu.mx",
  "alumnos.unidep.edu.mx",
  "campus.norte.unidep.edu.mx",
];

const denied = [
  "unidep.com",
  "unidep.edu.com",
  "unidep.edu.mx.evil.com",
  "unidep.mx.evil.com",
  "edu.unidep.mx",
];

test("API domain access rules allow expected UNIDEP domains", () => {
  const domains = API_UNIVERSITY_DOMAINS.unidep;
  for (const domain of allowed) {
    assert.equal(isAllowedApiDomain(domain, domains), true, `${domain} should be allowed`);
  }
  for (const domain of denied) {
    assert.equal(isAllowedApiDomain(domain, domains), false, `${domain} should be denied`);
  }
});

test("UI domain access rules match expected UNIDEP domains", () => {
  const domains = UI_UNIVERSITY_DOMAINS.unidep;
  for (const domain of allowed) {
    assert.equal(isAllowedUiDomain(domain, domains), true, `${domain} should be allowed`);
  }
  for (const domain of denied) {
    assert.equal(isAllowedUiDomain(domain, domains), false, `${domain} should be denied`);
  }
});

test("Domain rules support @ prefixes and wildcard base domains", () => {
  const customDomains = ["@example.edu", "*.example.org"];

  const shouldAllow = ["example.edu", "example.org", "mail.example.org"];
  const shouldDeny = ["example.com", "example.org.evil.com"];

  for (const domain of shouldAllow) {
    assert.equal(isAllowedApiDomain(domain, customDomains), true, `API should allow ${domain}`);
    assert.equal(isAllowedUiDomain(domain, customDomains), true, `UI should allow ${domain}`);
  }
  for (const domain of shouldDeny) {
    assert.equal(isAllowedApiDomain(domain, customDomains), false, `API should deny ${domain}`);
    assert.equal(isAllowedUiDomain(domain, customDomains), false, `UI should deny ${domain}`);
  }
});
