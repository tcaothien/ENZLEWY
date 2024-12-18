const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');
const { dynamicCard } = require("songcard");
const fs = require('fs');
const path = require('path');
const musicIcons = require('../UI/icons/musicicons');
const { Riffy } = require('riffy');

module.exports = (client) => {
    if (config.excessCommands.lavalink) {
        const nodes = [
            {
                host: config.lavalink.lavalink.host,
                password: config.lavalink.lavalink.password,
                port: config.lavalink.lavalink.port,
                secure: config.lavalink.lavalink.secure
            }
        ];

        client.riffy = new Riffy(client, nodes, {
            send: (payload) => {
                const guild = client.guilds.cache.get(payload.d.guild_id);
                if (guild) guild.shard.send(payload);
            },
            defaultSearchPlatform: "ytmsearch",
            restVersion: "v4",
        });

        client.riffy.on('nodeConnect', (node) => {
            console.log(`\x1b[34m[ KẾT NỐI LAVALINK ]\x1b[0m Node đã kết nối: \x1b[32m${node.name}\x1b[0m`);
        });

        client.riffy.on('nodeError', (node, error) => {
            console.error(`\x1b[31m[ LAVALINK ]\x1b[0m Node \x1b[32m${node.name}\x1b[0m gặp lỗi: \x1b[33m${error.message}\x1b[0m`);
        });

        client.riffy.on('trackStart', async (player, track) => {
            const channel = client.channels.cache.get(player.textChannel);
            
            try {
                // Vô hiệu hóa các nút trước đó nếu có
                if (player.currentMessageId) {
                    const oldMessage = await channel.messages.fetch(player.currentMessageId);
                    if (oldMessage) {
                        const disabledComponents = oldMessage.components.map(row => {
                            return new ActionRowBuilder().addComponents(
                                row.components.map(button => ButtonBuilder.from(button).setDisabled(true))
                            );
                        });
                        await oldMessage.edit({ components: disabledComponents });
                    }
                }

                // Tạo hình ảnh bài hát với gói songcard
                const cardImage = await dynamicCard({
                    thumbnailURL: track.info.thumbnail,
                    songTitle: track.info.title,
                    songArtist: track.info.author,
                    trackRequester: "@All In One", // Hiển thị tên người yêu cầu bài hát
                    fontPath: path.join(__dirname, "../UI", "fonts", "AfacadFlux-Regular.ttf"), // Font tùy chỉnh
                });

                const attachment = new AttachmentBuilder(cardImage, {
                    name: 'songcard.png',
                });

                // Gửi embed với thông tin bài hát
                const embed = new EmbedBuilder()
                    .setAuthor({ name: "Đang phát nhạc", iconURL: musicIcons.playerIcon, url: "https://discord.gg/xQF9f9yUEM" })
                    .setDescription(`- Tên bài hát: **${track.info.title}**\n- Tác giả: **${track.info.author}**`)
                    .setImage('attachment://songcard.png')
                    .setFooter({ text: 'Let the Beat Drop!', iconURL: musicIcons.footerIcon })
                    .setColor('#FF00FF');

                const buttonsRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('volume_up').setEmoji('🔊').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('volume_down').setEmoji('🔉').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('pause').setEmoji('⏸️').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('resume').setEmoji('▶️').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('skip').setEmoji('⏭️').setStyle(ButtonStyle.Secondary)
                );

                const buttonsRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('stop').setEmoji('⏹️').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('clear_queue').setEmoji('🗑️').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('show_queue').setEmoji('📜').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('shuffle').setEmoji('🔀').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('loop').setEmoji('🔁').setStyle(ButtonStyle.Secondary)
                );

                const message = await channel.send({
                    embeds: [embed],
                    files: [attachment],
                    components: [buttonsRow, buttonsRow2]
                });

                player.currentMessageId = message.id;
                
            } catch (error) {
                console.error('Lỗi tạo hoặc gửi song card:', error);
            }
        });

        client.riffy.on('queueEnd', (player) => {
            const channel = client.channels.cache.get(player.textChannel);
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: "Danh sách phát trống",
                    iconURL: musicIcons.alertIcon,
                    url: "https://discord.gg/enzlewy"
                })
                .setDescription('**Thoát khỏi kênh thoại!**')
                .setFooter({ text: 'Let the Beat Drop!', iconURL: musicIcons.footerIcon })
                .setColor('#FFFF00');
            channel.send({ embeds: [embed] });
            player.destroy();
        });

        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;

            const player = client.riffy.players.get(interaction.guildId);

            // Xử lý các nút bấm
            switch (interaction.customId) {
                case 'volume_up':
                    player.setVolume(Math.min(player.volume + 10, 100));
                    interaction.reply({ content: 'Tăng âm lượng!', ephemeral: true });
                    break;

                case 'volume_down':
                    player.setVolume(Math.max(player.volume - 10, 0));
                    interaction.reply({ content: 'Giảm âm lượng!', ephemeral: true });
                    break;

                case 'pause':
                    player.pause(true);
                    interaction.reply({ content: 'Tạm dừng phát nhạc.', ephemeral: true });
                    break;

                case 'resume':
                    player.pause(false);
                    interaction.reply({ content: 'Tiếp tục phát nhạc.', ephemeral: true });
                    break;

                case 'skip':
                    player.stop(); 
                    interaction.reply({ content: 'Chuyển bài tiếp theo.', ephemeral: true });
                    break;

                case 'stop':
                    player.destroy(); 
                    interaction.reply({ content: 'Dừng phát nhạc và ngắt kết nối.', ephemeral: true });
                    break;

                case 'clear_queue':
                    player.queue.clear();
                    interaction.reply({ content: 'Đã xóa danh sách phát.', ephemeral: true });
                    break;

                case 'show_queue':
                    if (!player || !player.queue.length) {
                        return interaction.reply({ content: 'Danh sách phát trống.', ephemeral: true });
                    }
                    const queueEmbed = new EmbedBuilder()
                        .setTitle('Danh sách bài hát hiện tại')
                        .setColor('#00FF00')
                        .setDescription(
                            player.queue.map((track, index) => `${index + 1}. **${track.info.title}**`).join('\n')
                        );
                    await interaction.reply({ embeds: [queueEmbed], ephemeral: true });
                    break;

                case 'shuffle':
                    if (player.queue.size > 0) {
                        player.queue.shuffle();
                        interaction.reply({ content: 'Đã xáo trộn danh sách phát!', ephemeral: true });
                    } else {
                        interaction.reply({ content: 'Danh sách phát trống!', ephemeral: true });
                    }
                    break;

                case 'loop':
                    let loopMode = player.loop || 'none';
                    if (loopMode === 'none') {
                        player.setLoop('track'); 
                        loopMode = 'track';
                    } else if (loopMode === 'track') {
                        player.setLoop('queue'); 
                        loopMode = 'queue';
                    } else {
                        player.setLoop('none'); 
                        loopMode = 'none';
                    }
                    interaction.reply({ content: `Chế độ lặp được đặt thành: **${loopMode}**.`, ephemeral: true });
                    break;
            }
        });

        client.on('raw', d => client.riffy.updateVoiceState(d));

        client.once('ready', () => {
            console.log('\x1b[35m[ MUSIC 2 ]\x1b[0m', '\x1b[32mHệ thống nhạc đã hoạt động ✅\x1b[0m');
            client.riffy.init(client.user.id);
        });
    } else {
        console.log('\x1b[31m[ MUSIC 2 ]\x1b[0m', '\x1b[31mHệ thống nhạc đã tắt ❌\x1b[0m');
    }
};
