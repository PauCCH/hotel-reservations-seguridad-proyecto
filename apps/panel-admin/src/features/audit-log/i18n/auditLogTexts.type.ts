export type AuditLogTexts = {
  PAGE: {
    TITLE_PREFIX: string;
    TITLE_ACCENT: string;
    DESCRIPTION: string;
  };
  TABLE: {
    COL_TIMESTAMP: string;
    COL_ACTION: string;
    COL_ACTOR: string;
    COL_ENTITY: string;
    COL_METADATA: string;
    NO_RESULTS: string;
  };
  FILTERS: {
    SEARCH_PLACEHOLDER: string;
    SEARCH_ARIA_LABEL: string;
    ACTION_LABEL: string;
    ACTION_ALL: string;
    FROM_LABEL: string;
    TO_LABEL: string;
    CLEAR: string;
  };
  PAGINATION: {
    SHOWING: string;
    OF: string;
    ITEMS_LABEL: string;
    PREVIOUS: string;
    NEXT: string;
  };
  DRAWER: {
    TITLE: string;
    ACTOR_LABEL: string;
    ACTION_LABEL: string;
    ENTITY_LABEL: string;
    TIMESTAMP_LABEL: string;
    METADATA_LABEL: string;
    CLOSE: string;
  };
};
