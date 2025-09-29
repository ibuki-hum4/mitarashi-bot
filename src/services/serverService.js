import prisma from '../database/client.js';
import { getGuildConfig, upsertGuildConfig } from '../database/repositories/guildRepository.js';

export async function getGuildStats(guild) {
  const [members, channelCount, roleCount, counts] = await Promise.all([
    guild.members.fetch(),
    guild.channels.fetch().then((channels) => channels.size).catch(() => guild.channels.cache.size),
    guild.roles.fetch().then((roles) => roles.size).catch(() => guild.roles.cache.size),
    prisma.$transaction([
      prisma.reminder.count({ where: { guildId: guild.id } }),
      prisma.task.count({ where: { guildId: guild.id } }),
      prisma.note.count({ where: { guildId: guild.id } }),
      prisma.poll.count({ where: { guildId: guild.id } }),
      prisma.warning.count({ where: { guildId: guild.id } })
    ])
  ]);

  const presenceCounts = members.reduce(
    (acc, member) => {
      if (member.user.bot) return acc;
      if (member.presence?.status === 'online') acc.online += 1;
      else if (member.presence?.status === 'idle') acc.idle += 1;
      else if (member.presence?.status === 'dnd') acc.dnd += 1;
      else acc.offline += 1;
      return acc;
    },
    { online: 0, idle: 0, dnd: 0, offline: 0 }
  );

  const [reminderCount, taskCount, noteCount, pollCount, warningCount] = counts;

  return {
    memberTotal: guild.memberCount,
    humanMembers: members.filter((m) => !m.user.bot).size,
    botMembers: members.filter((m) => m.user.bot).size,
    presence: presenceCounts,
    channelCount,
    roleCount,
    reminderCount,
    taskCount,
    noteCount,
    pollCount,
    warningCount
  };
}

export function getGuildSettings(guildId) {
  return getGuildConfig(guildId);
}

export function updateGuildSettings(guildId, data) {
  return upsertGuildConfig(guildId, data);
}
