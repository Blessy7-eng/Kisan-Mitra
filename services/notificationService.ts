import { AuthenticatedUser } from '@/lib/auth'
import { sendSMSNotification, SMSDispatchResult } from './smsService'

export interface AppNotification {
  id: string
  userId: string
  title: string
  message: string
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ALERT'
  createdAt: string
  read: boolean
  smsDispatch?: SMSDispatchResult
}

// In-memory or transient storage for notifications
const inMemoryNotifications: AppNotification[] = [
  {
    id: 'notif_1',
    userId: 'all',
    title: 'Kisan-Mitra Queue Operations Active',
    message: 'Real-time queue tracking and token monitoring operational across APMC centres.',
    type: 'INFO',
    createdAt: new Date().toISOString(),
    read: false,
  },
]

export async function getUserNotifications(currentUser: AuthenticatedUser): Promise<AppNotification[]> {
  return inMemoryNotifications.filter(
    (n) => n.userId === currentUser.id || n.userId === 'all' || (currentUser.role === 'OFFICER' && n.userId === 'officers')
  )
}

export async function createNotification(
  targetUserId: string,
  title: string,
  message: string,
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'ALERT' = 'INFO',
  phoneForSMS?: string,
  smsTemplate?: 'BOOKING_CONFIRMED' | 'TOKEN_ISSUED' | 'DELAY_ALERT' | 'STATUS_UPDATE',
  smsVariables?: Record<string, string | number>
): Promise<AppNotification> {
  let smsResult: SMSDispatchResult | undefined = undefined

  if (phoneForSMS && smsTemplate && smsVariables) {
    smsResult = await sendSMSNotification(phoneForSMS, smsTemplate, smsVariables)
  }

  const notification: AppNotification = {
    id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    userId: targetUserId,
    title,
    message,
    type,
    createdAt: new Date().toISOString(),
    read: false,
    smsDispatch: smsResult,
  }

  inMemoryNotifications.unshift(notification)
  if (inMemoryNotifications.length > 100) {
    inMemoryNotifications.pop()
  }

  return notification
}
