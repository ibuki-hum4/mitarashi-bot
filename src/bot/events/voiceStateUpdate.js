import { endVoiceSession, startVoiceSession } from '../../services/activityService.js';
import { getOrCreateUser } from '../../database/repositories/userRepository.js';

export default {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    if (!newState.guild || newState.member?.user?.bot) return;

    const userRecord = await getOrCreateUser(newState.member?.user ?? oldState.member?.user);
    const guildId = newState.guild.id;
    const userId = userRecord.id;

    if (!oldState.channelId && newState.channelId) {
      startVoiceSession(guildId, userId);
      return;
    }

    if (oldState.channelId && !newState.channelId) {
      await endVoiceSession(guildId, userId);
      return;
    }

    if (oldState.channelId !== newState.channelId) {
      await endVoiceSession(guildId, userId);
      startVoiceSession(guildId, userId);
    }
  }
};
