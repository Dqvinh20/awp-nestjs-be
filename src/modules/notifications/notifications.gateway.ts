import {
	Logger,
	UsePipes,
	ValidationError,
	ValidationPipe,
} from '@nestjs/common';
import {
	ConnectedSocket,
	MessageBody,
	OnGatewayConnection,
	OnGatewayDisconnect,
	SubscribeMessage,
	WebSocketGateway,
	WebSocketServer,
	WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
	ServerEvents,
	SocketBroadcastParams,
} from 'src/types/notifications.type';

@UsePipes(
	new ValidationPipe({
		exceptionFactory(validationErrors: ValidationError[] = []) {
			const errors = this.flattenValidationErrors(validationErrors);
			return new WsException(errors);
		},
	}),
)
@WebSocketGateway({
	cors: {
		origin: true,
		credentials: true,
	},
})
export class NotificationsGateway
	implements OnGatewayConnection, OnGatewayDisconnect
{
	@WebSocketServer()
	private readonly server: Server;
	logger = new Logger(NotificationsGateway.name);

	constructor(
		private readonly notifications_service: NotificationsService,
		private readonly event_emitter: EventEmitter2,
	) {}

	handleDisconnect(client: Socket) {
		this.logger.debug(`Client disconnected: ${client.id}`);
	}

	async handleConnection(client: Socket) {
		await this.notifications_service.authenSocketUser(client);
		if (client.connected) {
			this.logger.debug(`Client connected: ${client.id}`);
		}
	}

	@SubscribeMessage('join')
	joinRoom(@ConnectedSocket() socket: Socket, @MessageBody() roomId: string) {
		this.logger.debug(`User ${socket.id} join room '${roomId}'`);
		return socket.join(roomId);
	}

	@SubscribeMessage('leave')
	leaveRoom(@ConnectedSocket() socket: Socket, @MessageBody() roomId: string) {
		this.logger.debug(`User ${socket.id} left room '${roomId}'`);
		return socket.leave(roomId);
	}

	@OnEvent(ServerEvents.GRADE_FINISHED, { async: true })
	async handleCreateNotificationToClass(
		event: string,
		data: CreateNotificationDto,
	) {
		const notif = await this.notifications_service.create(data);
		await this.broadcast({
			room: [data.class, ...data.receivers.map((id: any) => id.toString())],
			event,
			data: notif,
		});
	}

	@OnEvent(ServerEvents.SOCKET_BROADCAST)
	broadcast({ room, event, data }: SocketBroadcastParams) {
		this.logger.debug(
			`Broadcast notification to '${room}' with event '${event}' and data`,
		);
		if (room) {
			return this.server.to(room).emit(event, data);
		}

		return this.server.emit(event, data);
	}
}
