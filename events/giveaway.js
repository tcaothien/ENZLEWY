const { ButtonBuilder, ButtonStyle, EmbedBuilder, ActionRowBuilder } = require('discord.js');
const { saveGiveaway, getGiveaways, deleteGiveaway } = require('../mongodb');

module.exports = (client) => {
  client.giveaways = [];

  async function loadGiveaways() {
    client.giveaways = await getGiveaways();
  }

  loadGiveaways();

  client.once('ready', () => {
    setInterval(checkGiveaways.bind(null, client), 5000); 
  });

  client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
      const giveaway = client.giveaways.find(g => g.messageId === interaction.message.id);
      if (!giveaway) return;

      if (interaction.customId === 'enter_giveaway') {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        
        if (giveaway.role && !member.roles.cache.has(giveaway.role)) {
          return interaction.reply({ content: 'Bạn không có vai trò cần thiết để tham gia giveaway này.', ephemeral: true })
            .catch(err => console.error('Không thể trả lời tương tác:', err));
        }
      
        if (!giveaway.entries.includes(interaction.user.id)) {
          giveaway.entries.push(interaction.user.id);
          await saveGiveaway(giveaway);
      
          await interaction.deferUpdate();
      
          await interaction.editReply({ 
            components: [createGiveawayButtons(giveaway)] 
          })
          .catch(err => console.error('Không thể cập nhật tương tác:', err));
      
          await interaction.followUp({ 
            content: 'Bạn đã tham gia giveaway!', 
            ephemeral: true 
          })
          .catch(err => console.error('Không thể trả lời thêm cho tương tác:', err));
        } else {
          await interaction.reply({ 
            content: 'Bạn đã tham gia giveaway này rồi.', 
            ephemeral: true 
          })
          .catch(err => console.error('Không thể trả lời tương tác:', err));
        }
      }
      else if (interaction.customId === 'view_participants') {
        const participants = giveaway.entries.map(entry => `<@${entry}>`).join('\n') || '❌ Chưa có người tham gia nào.';
      
        const embed = new EmbedBuilder()
          .setTitle('Danh sách người tham gia Giveaway')
          .setDescription(participants)
          .setColor(0x7289da)
          .setFooter({ text: `ID Giveaway: ${giveaway.messageId}` });
      
        await interaction.reply({ embeds: [embed], ephemeral: true })
          .catch(err => console.error('Không thể trả lời tương tác:', err));
      }
    }
  });

  async function checkGiveaways(client) {
    const now = Date.now();
    if (!client.giveaways) return;

    const newGiveaways = [];
    for (const giveaway of client.giveaways) {
      if (giveaway.endTime <= now) {
        const channel = await client.channels.fetch(giveaway.channel);
        if (!channel) continue;

        const winners = [];
        while (winners.length < giveaway.winners && giveaway.entries.length > 0) {
          const winnerId = giveaway.entries.splice(Math.floor(Math.random() * giveaway.entries.length), 1)[0];
          winners.push(`<@${winnerId}>`);
        }

        await channel.send({
          embeds: [{
            title: '🎉 Giveaway Đã Kết Thúc! 🎉',
            description: `Phần thưởng: **${giveaway.prize}**\nNgười chiến thắng: ${winners.length > 0 ? winners.join(', ') : 'Không có lượt tham gia hợp lệ.'}`,
            color: 0x7289da
          }]
        });

        await deleteGiveaway(giveaway.messageId); 
      } else {
        newGiveaways.push(giveaway);
      }
    }
    client.giveaways = newGiveaways;
  }

  function createGiveawayButtons(giveaway) {
    const enterButton = new ButtonBuilder()
      .setCustomId('enter_giveaway')
      .setLabel(`🎉 Tham gia Giveaway (${giveaway.entries.length})`)
      .setStyle(ButtonStyle.Danger);

    const viewButton = new ButtonBuilder()
      .setCustomId('view_participants')
      .setLabel('Người tham gia')
      .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder().addComponents(enterButton, viewButton);
  }
};
