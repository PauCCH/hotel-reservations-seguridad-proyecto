export type ReservationsTexts = {
  PAGE: {
    TITLE_PREFIX: string;
    TITLE_ACCENT: string;
    DESCRIPTION: string;
    NEW_RESERVATION: string;
  };
  TABLE: {
    ARIA_LABEL: string;
    COL_CODE: string;
    COL_GUEST: string;
    COL_ROOM: string;
    COL_CHECKIN: string;
    COL_CHECKOUT: string;
    COL_NIGHTS: string;
    COL_TOTAL: string;
    COL_STATUS: string;
    COL_ACTIONS: string;
  };
  STATUS: {
    PENDING: string;
    APPROVED: string;
    CANCELLED: string;
    COMPLETED: string;
  };
  ACTIONS: {
    VIEW_DETAIL: string;
    VIEW_MORE: string;
    VIEW_LESS: string;
    COPY_CODE: string;
  };
  DETAIL: {
    SECTION_CLIENT: string;
    SECTION_ROOM: string;
    SECTION_PAYMENT: string;
    LABEL_EMAIL: string;
    LABEL_PHONE: string;
    LABEL_NOTES: string;
    LABEL_CATEGORY: string;
    LABEL_GUESTS_TOTAL: string;
    LABEL_ADULTS: string;
    LABEL_CHILDREN: string;
    LABEL_PETS: string;
    LABEL_CHECKIN: string;
    LABEL_CHECKOUT: string;
    LABEL_PRICE_PER_NIGHT: string;
    LABEL_NIGHTS: string;
    LABEL_NIGHT: string;
    LABEL_SUBTOTAL: string;
    LABEL_CURRENCY: string;
    ARRIVES_TODAY: string;
    BTN_CANCEL: string;
    BTN_SAVE: string;
    BTN_APPROVE: string;
    BTN_CANCELATION: string;
    BTN_COMPLETE: string;
  };
  STATUS_MANAGEMENT: {
    LABEL_CURRENT_STATUS: string;
    LABEL_CANCELLATION_REASON: string;
    BTN_APPROVE: string;
    BTN_CANCEL_RESERVATION: string;
    BTN_COMPLETE_RESERVATION: string;
    BTN_REVERT: string;
    BTN_SAVE_CHANGES: string;
    LOG_PAYMENT_PROCESSED: string;
  };
  CANCELLATION_MODAL: {
    TITLE: string;
    TEXTAREA_LABEL: string;
    TEXTAREA_PLACEHOLDER: string;
    CHAR_COUNTER_LABEL: string;
    BTN_CONFIRM: string;
  };
  SAVE_DIALOG: {
    TITLE: string;
    DESCRIPTION: string;
    BTN_CONFIRM: string;
    BTN_CANCEL: string;
  };
  UNSAVED_CHANGES_MODAL: {
    TITLE: string;
    DESCRIPTION: string;
    BTN_STAY: string;
  };
  EMPTY: {
    TITLE: string;
    DESCRIPTION: string;
  };
  STATS: {
    PENDING_LABEL: string;
    PENDING_NOTE: string;
    APPROVED_LABEL: string;
    APPROVED_NOTE: string;
    TOTAL_LABEL: string;
    TOTAL_NOTE: string;
  };
  FILTERS: {
    ALL: string;
    PLACEHOLDER_ROOM: string;
    ARIA_LABEL_ROOM_FILTER: string;
    PLACEHOLDER_GUEST_SEARCH: string;
    ARIA_LABEL_GUEST_SEARCH: string;
    DATE_RANGE_PICKER_LABEL: string;
    ARIA_LABEL_DATE_RANGE: string;
    CLEAR: string;
    RESULTS_SUFFIX: string;
    RESULTS_OF: string;
  };
  DETAIL_PAGE: {
    BACK_TO_LIST: string;
    PAGE_TITLE: string;
    STAT_STATUS_LABEL: string;
  };
  BOOKING_MODE: {
    LABEL: string;
    AUTOMATIC: string;
    MANUAL: string;
  };
  ERRORS: {
    FETCH_RESERVATIONS: string;
    FETCH_ROOMS: string;
    UPDATE_STATUS: string;
    FETCH_BOOKING_MODE: string;
    UPDATE_BOOKING_MODE: string;
  };
};
