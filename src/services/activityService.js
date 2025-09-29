import dayjs from 'dayjs';
import prisma from '../database/client.js';

const voiceSessionMap = new Map();

function getActivityDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function upsertActivityRecord({ guildId, userId, date, updateData, createData }) {
  try {
    return await prisma.activityRecord.upsert({
      where: {
        guildId_userId_date: {
          guildId,
          userId,
          date
        }
      },
      update: {
        ...updateData,
        lastUpdated: new Date()
      },
      create: {
        guildId,
        userId,
        date,
        ...createData,
        lastUpdated: new Date()
      }
    });
  } catch (error) {
    if (error?.code === 'P2002') {
      return prisma.activityRecord.update({
        where: {
          guildId_userId_date: {
            guildId,
            userId,
            date
          }
        },
        data: {
          ...updateData,
          lastUpdated: new Date()
        }
      });
    }
    throw error;
  }
}

export async function recordMessageActivity(guildId, userId) {
  const date = getActivityDate();
  await upsertActivityRecord({
    guildId,
    userId,
    date,
    updateData: {
      messageCount: {
        increment: 1
      }
    },
    createData: {
      messageCount: 1,
      voiceMinutes: 0
    }
  });
}

export function startVoiceSession(guildId, userId) {
  voiceSessionMap.set(`${guildId}:${userId}`, Date.now());
}

export async function endVoiceSession(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const startedAt = voiceSessionMap.get(key);
  if (!startedAt) return;
  voiceSessionMap.delete(key);
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
  const date = getActivityDate();
  await upsertActivityRecord({
    guildId,
    userId,
    date,
    updateData: {
      voiceMinutes: {
        increment: minutes
      }
    },
    createData: {
      messageCount: 0,
      voiceMinutes: minutes
    }
  });
}

export async function getActivityLeaderboard(guildId, days = 7, limit = 10) {
  const since = dayjs().subtract(days - 1, 'day').startOf('day').toDate();
  const records = await prisma.activityRecord.groupBy({
    by: ['userId'],
    where: {
      guildId,
      date: {
        gte: since
      }
    },
    _sum: {
      messageCount: true,
      voiceMinutes: true
    },
    orderBy: {
      _sum: {
        messageCount: 'desc'
      }
    },
    take: limit
  });

  const userIds = records.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } }
  });

  const userMap = new Map(users.map((user) => [user.id, user]));

  return records.map((record) => ({
    user: userMap.get(record.userId),
    messageCount: record._sum.messageCount ?? 0,
    voiceMinutes: record._sum.voiceMinutes ?? 0
  }));
}
