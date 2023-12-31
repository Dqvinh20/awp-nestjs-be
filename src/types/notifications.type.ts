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

enum ClassGradeEvent {
	GRADE_FINISHED = 'grade.finished',
	GRADE_UNFINISHED = 'grade.unfinished',
}

enum GradeReviewEvent {
	GRADE_REVIEW_CREATED = 'grade_review.created',
	GRADE_REVIEW_COMMENT = 'grade_review.comment',
	GRADE_REVIEW_FINISHED = 'grade_review.finished',
}

enum SocketEvent {
	SOCKET_BROADCAST = 'notification.broadcast',
}

export const ServerEvents = {
	...ClassGradeEvent,
	...SocketEvent,
	...GradeReviewEvent,
};

export type ServerEvents = ClassGradeEvent | SocketEvent | GradeReviewEvent;

export interface SocketBroadcastParams {
	room: string | string[];
	event: string;
	data: any;
}
