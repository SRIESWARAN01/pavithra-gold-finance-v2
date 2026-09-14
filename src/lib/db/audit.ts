// src/lib/db/audit.ts
// Data access layer for audit logging — tracks all administrative actions backed by Cloud Firestore.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import type { AuditLog, AuditLogInsert } from '@/types/database';

const COLLECTION = 'audit_logs';

/**
 * Record an audit log entry.
 * Should be called after any significant admin action (create/update/delete).
 */
export async function logAuditAction(data: AuditLogInsert): Promise<void> {
  try {
    await addDoc(collection(db, COLLECTION), {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    // Audit logging should never block the main operation, so we log but don't throw
    console.error(`[Audit] Failed to log action: ${error.message}`, data);
  }
}

/**
 * Convenience wrapper for common audit actions.
 */
export async function auditCreate(
  actorId: string,
  entity: string,
  entityId: string,
  newState: Record<string, unknown>
): Promise<void> {
  await logAuditAction({
    actor_id: actorId,
    action_type: 'CREATE',
    affected_entity: entity,
    affected_entity_id: entityId,
    new_state: newState,
  });
}

export async function auditUpdate(
  actorId: string,
  entity: string,
  entityId: string,
  oldState: Record<string, unknown>,
  newState: Record<string, unknown>
): Promise<void> {
  await logAuditAction({
    actor_id: actorId,
    action_type: 'UPDATE',
    affected_entity: entity,
    affected_entity_id: entityId,
    old_state: oldState,
    new_state: newState,
  });
}

export async function auditDelete(
  actorId: string,
  entity: string,
  entityId: string,
  oldState: Record<string, unknown>
): Promise<void> {
  await logAuditAction({
    actor_id: actorId,
    action_type: 'DELETE',
    affected_entity: entity,
    affected_entity_id: entityId,
    old_state: oldState,
  });
}

export async function auditStatusChange(
  actorId: string,
  entity: string,
  entityId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  await logAuditAction({
    actor_id: actorId,
    action_type: 'STATUS_CHANGE',
    affected_entity: entity,
    affected_entity_id: entityId,
    old_state: { status: oldStatus },
    new_state: { status: newStatus },
  });
}

/**
 * Get audit log entries with filters and pagination.
 */
export async function getAuditLogs(options?: {
  actorId?: string;
  entity?: string;
  entityId?: string;
  actionType?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ logs: AuditLog[]; count: number }> {
  try {
    let q;
    if (options?.actorId) {
      q = query(collection(db, COLLECTION), where('actor_id', '==', options.actorId));
    } else if (options?.entity) {
      q = query(collection(db, COLLECTION), where('affected_entity', '==', options.entity));
    } else if (options?.actionType) {
      q = query(collection(db, COLLECTION), where('action_type', '==', options.actionType));
    } else {
      q = query(collection(db, COLLECTION));
    }

    const snapshot = await getDocs(q);

    const allLogs: AuditLog[] = [];
    for (const d of snapshot.docs) {
      const data = d.data();
      if (options?.actorId && data.actor_id !== options.actorId) continue;
      if (options?.entity && data.affected_entity !== options.entity) continue;
      if (options?.entityId && data.affected_entity_id !== options.entityId) continue;
      if (options?.actionType && data.action_type !== options.actionType) continue;

      const log: any = { id: d.id, ...data };
      if (log.actor_id) {
        try {
          const actorSnap = await getDoc(doc(db, 'profiles', log.actor_id));
          if (actorSnap.exists()) {
            log.actor = { name: actorSnap.data().name };
          }
        } catch {}
      }
      allLogs.push(log as AuditLog);
    }

    allLogs.sort((a: any, b: any) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    // Client-side pagination
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    const paginated = allLogs.slice(start, start + pageSize);

    return { logs: paginated, count: allLogs.length };
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return { logs: [], count: 0 };
  }
}
