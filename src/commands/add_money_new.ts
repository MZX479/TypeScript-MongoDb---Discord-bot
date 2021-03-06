import * as Discord from 'discord.js';
import * as DB from 'mongodb';
import { type Command } from '../types';
import { type UserType } from '../types';

const command: Command = {
  slash: {
    name: 'addmoney',
    description: 'adding money to user or member',
    options: [
      {
        name: 'amount',
        description: 'amount of money',
        type: 4,
        required: true,
      },
      {
        name: 'ping',
        description: 'ping a user',
        type: 6,
        required: false,
      },
      {
        name: 'id',
        description: 'using user_id',
        type: 3,
        required: false,
      },
    ],
  },
  async execute(bot, f, mongo, args, interaction) {
    const db: DB.Db = mongo.db(interaction.guild!.id);
    try {
      class AddMoney {
        private interaction: Discord.CommandInteraction;
        private db: DB.Db;
        private member_id!: string;
        constructor(interaction: Discord.CommandInteraction) {
          this.interaction = interaction;
          this.db = db;
          this.member_id;

          this.main();
        }

        async main(): Promise<void> {
          let member = <Discord.GuildMember>(
            args.filter((arg) => arg.name === 'ping')[0]?.member
          );
          let member_id = <string>(
            args.filter((arg) => arg.name === 'id')[0]?.value
          );

          if (!member && member_id) {
            member = await interaction.guild!.members.fetch(member_id);
            member_id = member.id;
          }

          let roles_check = <Discord.GuildMemberRoleManager>(
            this.interaction.member?.roles
          );

          if (!roles_check.cache.has('904339446168694806'))
            return this.response(
              'Error',
              '#ff0000',
              'You do not have a permission for that!',
              'https://cdn.discordapp.com/emojis/923899365385449472.webp?size=64&quality=lossless',
              true
            );

          this.member_id = member_id;

          let amount = Number(
            args.filter((arg) => arg.name === 'amount')[0].value
          );

          if (!amount || isNaN(amount) || amount <= 0 || amount > 300000)
            return this.response(
              'Error',
              '#ff0000',
              'Uncorrect amount (limit 300000)',
              'https://cdn.discordapp.com/emojis/923899365385449472.webp?size=64&quality=lossless',
              true
            );

          this.check_buttons(member, amount);
        }

        async response(
          title: string,
          color: Discord.ColorResolvable,
          description: string,
          thumbnail: string,
          ephemeral?: boolean
        ): Promise<void> {
          if (!title || !color || !description || !thumbnail)
            throw new Error('One of components was not provided!');

          interaction.followUp({
            embeds: [
              {
                title,
                author: {
                  name: this.interaction.user.tag,
                  iconURL: this.interaction.user.avatarURL({ dynamic: true })!,
                },
                thumbnail: {
                  url: thumbnail,
                },
                color,
                description,
              },
            ],
            ephemeral: ephemeral,
          });
        }

        private async check_buttons(
          member: Discord.GuildMember,
          amount: number
        ): Promise<void> {
          const buttons: Discord.MessageButton[] = [
            new Discord.MessageButton()
              .setLabel('Yes')
              .setStyle('SUCCESS')
              .setDisabled(false)
              .setCustomId('yes'),
            new Discord.MessageButton()
              .setLabel('No')
              .setStyle('DANGER')
              .setDisabled(false)
              .setCustomId('no'),
          ];

          const ask_answer = <Discord.Message>await interaction.followUp({
            content: 'Are you sure about this?',
            components: [
              new Discord.MessageActionRow().addComponents(...buttons),
            ],
            fetchReply: true,
          });

          let answer = await ask_answer.awaitMessageComponent({
            filter: (button) => interaction.user.id === button.user.id,
            time: 180000,
          });

          ask_answer.delete();

          switch (answer.customId) {
            case 'yes':
              await this._overwrite_member_data(member.id, amount);
              this.response(
                'Success',
                '#00ff00',
                `You successfully added \`${amount}\` to \`${member.user.tag}\``,
                'https://cdn.discordapp.com/emojis/966737934457905202.webp?size=128&quality=lossless'
              );
              break;

            case 'no':
              return this.response(
                'Error',
                '#ff0000',
                'Rejected by author',
                'https://cdn.discordapp.com/emojis/923899365385449472.webp?size=64&quality=lossless'
              );
            default:
              break;
          }
        }

        private async _overwrite_member_data(
          member_id: string,
          amount: number
        ): Promise<void> {
          if (!member_id) throw new Error('Member_id was not given!');

          let _users_db: DB.Document = this.db.collection('users');

          let _current_user = <UserType>(
            ((await _users_db.findOne({ login: member_id })) || {})
          );

          let _new_user_ballance = Number(_current_user.coins || 0) + amount;

          if (!_current_user.login) {
            _users_db.insertOne({
              login: member_id,
              coins: _new_user_ballance,
            });
          } else {
            _users_db.updateOne(
              {
                login: member_id,
              },
              {
                $set: {
                  coins: _new_user_ballance,
                },
              }
            );
          }
        }
      }

      new AddMoney(interaction);
    } catch (err) {
      let e = <{ message: String; name: string }>err;
      bot.users.cache
        .get(f.config.owner)
        ?.send(`**ERROR** \`${e.name}\`\n\`${e.message}\``);
      console.error(e);
    }
  },
};

export { command };
