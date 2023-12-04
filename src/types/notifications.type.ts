enum TeacherClientNotificationEvents {
	ON_GRADE_COMPOSITION_CREATED = 'onGradeCompositionCreated',
	ON_GRADE_COMPOSITION_UPDATED = 'onGradeCompositionUpdated',
	ON_GRADE_REVIEWED = 'onGradeReviewed',
	ON_GRADE_REVIEW_REPLIED = 'onGradeReviewReplied',
}

enum StudentClientNotificationEvents {
	ON_REQUEST_GRADE_REVIEW = 'onRequestGradeReview',
}

enum BaseClientNotificationEvents {
	ON_NEW_NOTIFICATION = 'onNewNotification',
}

export const ClientNotificationEvents = {
	...TeacherClientNotificationEvents,
	...StudentClientNotificationEvents,
	...BaseClientNotificationEvents,
};

export type ClientNotificationEvents =
	| TeacherClientNotificationEvents
	| StudentClientNotificationEvents
	| BaseClientNotificationEvents;
