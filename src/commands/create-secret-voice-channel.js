import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} from "discord.js";

import db from "../db.js";

const MAX_INVITES = 10;

export default {
  data: (() => {
    const builder = new SlashCommandBuilder()
      .setName("create-secret-voice-channel")
      .setDescription("특정 유저만 접근 가능한 음성 채널을 생성합니다.")
      .addStringOption((opt) =>
        opt.setName("name").setDescription("채널 이름").setRequired(true)
      );

    for (let i = 1; i <= MAX_INVITES; i++) {
      builder.addUserOption((opt) =>
        opt.setName(`user${i}`).setDescription(`초대할 유저 ${i}`)
      );
    }

    return builder;
  })(),

  async execute(interaction) {
    const name = interaction.options.getString("name");
    const invitedUsers = [];

    for (let i = 1; i <= MAX_INVITES; i++) {
      const user = interaction.options.getUser(`user${i}`);
      if (user) invitedUsers.push(user);
    }

    const channel = await interaction.guild.channels.create({
      name,
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: interaction.guild.roles.everyone,
          deny: [PermissionFlagsBits.Connect],
        },
        { id: interaction.user.id, allow: [PermissionFlagsBits.Connect] },
        ...invitedUsers.map((user) => ({
          id: user.id,
          allow: [PermissionFlagsBits.Connect],
        })),
      ],
    });

    const channelLink = `https://discord.com/channels/${interaction.guild.id}/${channel.id}`;

    const sendInvite = async (user) => {
      try {
        await user.send({
          content: `🎤 \`${name}\` 음성 채널에 초대되었어요!\n👉 [채널 열기](${channelLink})`,
        });
      } catch (err) {
        console.error("DM 전송 실패:", err);
        await interaction.followUp({
          content: `${user.username}님에게 DM을 보낼 수 없습니다.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    };

    await interaction.reply({
      content: "초대 링크를 보내는 중입니다...",
      flags: MessageFlags.Ephemeral,
    });

    for (const user of [interaction.user, ...invitedUsers]) {
      await sendInvite(user);
    }

    await interaction.followUp({
      content: `🔒 \`${name}\` 채널이 생성되었고, 초대 유저에게 링크가 전송되었습니다.`,
      flags: MessageFlags.Ephemeral,
    });

    db.data.trackedChannels.push(channel.id);
    await db.write();
  },
};
