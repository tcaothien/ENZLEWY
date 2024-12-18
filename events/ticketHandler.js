const { ticketsCollection } = require('../mongodb');
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const ticketIcons = require('../UI/icons/ticketicons');

let config = {};

async function loadConfig() {
    try {
        const tickets = await ticketsCollection.find({}).toArray();
        config.tickets = tickets.reduce((acc, ticket) => {
            acc[ticket.serverId] = {
                ticketChannelId: ticket.ticketChannelId,
                adminRoleId: ticket.adminRoleId,
                status: ticket.status
            };
            return acc;
        }, {});
    } catch (err) {
        //console.error('Lỗi khi tải cấu hình từ MongoDB:', err);
    }
}

setInterval(loadConfig, 5000);

module.exports = (client) => {
    client.on('ready', async () => {
        await loadConfig();
        monitorConfigChanges(client);
    });

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isStringSelectMenu() && interaction.customId === 'select_ticket_type') {
            handleSelectMenu(interaction, client);
        } else if (interaction.isButton() && interaction.customId.startsWith('close_ticket_')) {
            handleCloseButton(interaction, client);
        }
    });
};

async function monitorConfigChanges(client) {
    let previousConfig = JSON.parse(JSON.stringify(config));

    setInterval(async () => {
        await loadConfig();
        if (JSON.stringify(config) !== JSON.stringify(previousConfig)) {
            for (const guildId of Object.keys(config.tickets)) {
                const settings = config.tickets[guildId];
                const previousSettings = previousConfig.tickets[guildId];

                if (settings && settings.status && settings.ticketChannelId && (!previousSettings || settings.ticketChannelId !== previousSettings.ticketChannelId)) {
                    const guild = client.guilds.cache.get(guildId);
                    if (!guild) continue;

                    const ticketChannel = guild.channels.cache.get(settings.ticketChannelId);
                    if (!ticketChannel) continue;

                    const embed = new EmbedBuilder()
                        .setAuthor({
                            name: "Chào mừng đến với Hỗ Trợ Ticket",
                            iconURL: ticketIcons.mainIcon,
                            url: "https://discord.gg/xQF9f9yUEM"
                        })
                        .setDescription('- Vui lòng chọn loại ticket từ menu bên dưới để tạo ticket mới.\n\n' +
                            '**Hướng Dẫn Tạo Ticket:**\n' +
                            '- Không tạo ticket trống.\n' +
                            '- Hãy kiên nhẫn chờ phản hồi từ đội ngũ hỗ trợ.')
                        .setFooter({ text: 'Chúng tôi luôn sẵn sàng giúp đỡ!', iconURL: ticketIcons.modIcon })
                        .setColor('#00FF00')
                        .setTimestamp();

                    const menu = new StringSelectMenuBuilder()
                        .setCustomId('select_ticket_type')
                        .setPlaceholder('Chọn loại ticket')
                        .addOptions([
                            { label: '🆘 Hỗ Trợ', value: 'support' },
                            { label: '📂 Gợi Ý', value: 'suggestion' },
                            { label: '💜 Phản Hồi', value: 'feedback' },
                            { label: '⚠️ Báo Cáo', value: 'report' }
                        ]);

                    const row = new ActionRowBuilder().addComponents(menu);

                    await ticketChannel.send({
                        embeds: [embed],
                        components: [row]
                    });

                    previousConfig = JSON.parse(JSON.stringify(config));
                }
            }
        }
    }, 5000);
}

async function handleSelectMenu(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const { guild, user, values } = interaction;
    if (!guild || !user) return;

    const guildId = guild.id;
    const userId = user.id;
    const ticketType = values[0];
    const settings = config.tickets[guildId];
    if (!settings) return;

    const ticketExists = await ticketsCollection.findOne({ guildId, userId });
    if (ticketExists) {
        return interaction.followUp({ content: 'Bạn đã có một ticket đang mở.', ephemeral: true });
    }

    const ticketChannel = await guild.channels.create({
        name: `${user.username}-${ticketType}-ticket`,
        type: ChannelType.GuildText,
        permissionOverwrites: [
            {
                id: guild.roles.everyone,
                deny: [PermissionsBitField.Flags.ViewChannel]
            },
            {
                id: userId,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
            },
            {
                id: settings.adminRoleId,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory]
            }
        ]
    });

    const ticketId = `${guildId}-${ticketChannel.id}`;
    await ticketsCollection.insertOne({ id: ticketId, channelId: ticketChannel.id, guildId, userId, type: ticketType });

    const ticketEmbed = new EmbedBuilder()
        .setAuthor({
            name: "Ticket Hỗ Trợ",
            iconURL: ticketIcons.modIcon,
            url: "https://discord.gg/xQF9f9yUEM"
        })
        .setDescription(`Xin chào ${user}, chào mừng bạn đến với kênh hỗ trợ!\n- Vui lòng cung cấp mô tả chi tiết về vấn đề của bạn.\n- Đội ngũ hỗ trợ sẽ giúp bạn sớm nhất có thể.\n- Bạn có thể tạo thêm ticket nếu cần.`)
        .setFooter({ text: 'Sự hài lòng của bạn là ưu tiên của chúng tôi', iconURL: ticketIcons.heartIcon })
        .setColor('#00FF00')
        .setTimestamp();

    const closeButton = new ButtonBuilder()
        .setCustomId(`close_ticket_${ticketId}`)
        .setLabel('Đóng Ticket')
        .setStyle(ButtonStyle.Danger);

    const actionRow = new ActionRowBuilder().addComponents(closeButton);

    await ticketChannel.send({ content: `${user}`, embeds: [ticketEmbed], components: [actionRow] });

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setAuthor({ 
            name: "Ticket Đã Được Tạo!", 
            iconURL: ticketIcons.correctIcon,
            url: "https://discord.gg/xQF9f9yUEM"
        })
        .setDescription(`- Ticket loại **${ticketType}** của bạn đã được tạo thành công.`)
        .addFields(
            { name: 'Kênh Ticket', value: `${ticketChannel.url}` },
            { name: 'Hướng Dẫn', value: 'Vui lòng mô tả vấn đề của bạn chi tiết.' }
        )
        .setTimestamp()
        .setFooter({ text: 'Cảm ơn vì đã liên hệ!', iconURL: ticketIcons.modIcon });

    await user.send({ content: `Ticket **${ticketType}** của bạn đã được tạo thành công.`, embeds: [embed] });

    interaction.followUp({ content: 'Ticket đã được tạo!', ephemeral: true });
}

async function handleCloseButton(interaction, client) {
    await interaction.deferReply({ ephemeral: true });

    const ticketId = interaction.customId.replace('close_ticket_', '');
    const { guild, user } = interaction;
    if (!guild || !user) return;

    const ticket = await ticketsCollection.findOne({ id: ticketId });
    if (!ticket) {
        return interaction.followUp({ content: 'Không tìm thấy ticket. Vui lòng báo cáo cho quản trị viên!', ephemeral: true });
    }

    const ticketChannel = guild.channels.cache.get(ticket.channelId);
    if (ticketChannel) {
        setTimeout(async () => {
            await ticketChannel.delete().catch(console.error);
        }, 5000);
    }

    await ticketsCollection.deleteOne({ id: ticketId });

    const ticketUser = await client.users.fetch(ticket.userId);
    if (ticketUser) {
        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setAuthor({ 
                name: "Ticket Đã Đóng!", 
                iconURL: ticketIcons.correctIcon,
                url: "https://discord.gg/xQF9f9yUEM"
            })
            .setDescription(`- Ticket của bạn đã được đóng.`)
            .setTimestamp()
            .setFooter({ text: 'Cảm ơn bạn đã liên hệ!', iconURL: ticketIcons.modIcon });

        await ticketUser.send({ content: `Ticket của bạn đã được đóng.`, embeds: [embed] });
    }

    interaction.followUp({ content: 'Ticket đã được đóng và người dùng đã được thông báo.', ephemeral: true });
}
