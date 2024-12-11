const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('marry')
        .setDescription('Cầu hôn một người đặc biệt trong server!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Người bạn muốn cầu hôn')
                .setRequired(true)),
    async execute(interaction) {
        const proposer = interaction.user;
        const partner = interaction.options.getUser('user');

        if (proposer.id === partner.id) {
            return interaction.reply({ content: 'Bạn không thể cầu hôn chính mình!', ephemeral: true });
        }

        const filter = response => response.author.id === partner.id;
        await interaction.reply(`${partner}, bạn có đồng ý kết hôn với ${proposer} không? (Gõ "yes" hoặc "no")`);

        try {
            const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000, errors: ['time'] });
            const response = collected.first();

            if (response.content.toLowerCase() === 'yes') {
                await interaction.followUp(`💍 ${proposer} đã kết hôn thành công với ${partner}!`);
            } else {
                await interaction.followUp(`${partner} đã từ chối lời cầu hôn. 💔`);
            }
        } catch (error) {
            await interaction.followUp(`${partner} đã không trả lời kịp thời.`);
        }
