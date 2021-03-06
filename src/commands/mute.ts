import * as Discord from 'discord.js';
import * as DB from 'mongodb';
import { type Command } from '../types';
import duration from 'parse-duration';

type mute_type = {
  moderator: string;
  reason: string;
  time: number;
  till: number;
};

type user_data_type = {
  login?: string;
  mutes?: mute_type[];
  isMuted?: mute_type;
};

const command: Command = {
  slash: {
    name: 'mute',
    description: 'Mute member',
    options: [
      {
        name: 'reason',
        description: 'Mute reason',
        type: 3,
        required: true,
      },
      {
        name: 'time',
        description: 'Mute time',
        type: 3,
        required: true,
      },
      {
        name: 'ping',
        description: 'Member ping',
        type: 6,
        required: false,
      },
      {
        name: 'id',
        description: 'Member id',
        type: 3,
        required: false,
      },
    ],
  },
  async execute(bot, f, mongo, args, interaction) {
    const db: DB.Db = mongo.db(interaction.guild!.id);
    try {
      class Mute {
        private member!: Discord.GuildMember;
        private member_id!: string;
        private mute_role_id = '870604224386433044';

        constructor() {
          this.main();
        }
        private async main() {
          let member = <Discord.GuildMember>(
            args.filter((arg) => arg.name === 'ping')[0]?.member
          );
          let member_id = <string>(
            args.filter((arg) => arg.name === 'id')[0]?.value
          );

          let string_time = <string>(
            args.filter((arg) => arg.name === 'time')[0]?.value
          );
          let reason = <string>(
            args.filter((arg) => arg.name === 'reason')[0]?.value
          );

          if (!member && member_id) {
            console.log(member_id);

            member = await interaction.guild!.members.fetch(member_id);
            member_id = member.id;
          }

          if (!member) return this.false_embed('Вы не указали пользователя!');

          this.member = member;
          this.member_id = member_id;

          const time = duration(string_time); // 7d -> в мс

          if (isNaN(time) || time <= 0)
            return this.false_embed('Bad time provided');
          if (!reason) return this.false_embed('No reason provided');

          const till = new Date().getTime() + time;

          const user_data = await this.get_data();

          const new_mute: mute_type = {
            moderator: interaction.user.id,
            till,
            time,
            reason,
          };

          const mutes_list = user_data.mutes || [];

          mutes_list.push(new_mute);

          user_data.mutes = mutes_list;
          user_data.isMuted = new_mute;

          const me = interaction.guild?.me; // Профиль бота на текущем сервере

          if (member.roles.highest.position >= me?.roles.highest.position!)
            return this.false_embed("I can't mute this member");
          if (member.user.bot) return this.false_embed("I can't mute bots.");

          const mute_role = interaction.guild?.roles.cache.get(
            this.mute_role_id
          );

          if (!mute_role) return this.false_embed("I can't find mute role");

          await member.roles.add(mute_role).catch((err) => {
            this.false_embed('Something went wrong.');
            console.error(err);
          });

          await this.update_data(user_data);

          this.true_embed(
            `You successfully muted \`${member.user.tag}\` for \`${string_time}\``
          );
        }

        async get_data() {
          const users_db = db.collection('users');
          const user_data = <user_data_type>((await users_db.findOne({
            login: this.member_id,
          })) || {});

          return user_data;
        }

        async update_data(data: user_data_type) {
          const users_db = db.collection('users');

          if (data.login) {
            return users_db.updateOne(
              {
                login: data.login,
              },
              {
                $set: {
                  mutes: data.mutes,
                  isMuted: data.isMuted,
                },
              }
            );
          } else {
            return users_db.insertOne({
              login: this.member_id,
              ...data,
            });
          }
        }

        private false_embed(content: string) {
          return interaction.followUp({
            embeds: [
              {
                color: 'RED',
                description: content,
                author: {
                  name: interaction.user.tag,
                  iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                },
              },
            ],
          });
        }

        private true_embed(content: string) {
          return interaction.followUp({
            embeds: [
              {
                color: 'GREEN',
                description: content,
                author: {
                  name: interaction.user.tag,
                  iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                },
              },
            ],
          });
        }
      }

      new Mute();
    } catch (err) {
      let e = <{ message: string; name: string }>err;
      bot.users.cache
        .get(f.config.owner)
        ?.send(`**ERROR** \`${e.name}\`\n\`${e.message}\``);
      console.error(e);
    }
  },
};

export { command };
