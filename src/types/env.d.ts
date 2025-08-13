declare namespace NodeJS {
  interface ProcessEnv {
    HOUSE_OF_COUNCILLORS_URL?: string;
    PAGE_LOAD_TIMEOUT?: string;
    NAVIGATION_TIMEOUT?: string;
    PROFILE_SCRAPE_TIMEOUT?: string;
    NETWORK_IDLE_TIMEOUT?: string;
  }
}
