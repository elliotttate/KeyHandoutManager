import { ApplicationCommandData, ApplicationCommandOptionType, ApplicationCommandType, AttachmentBuilder, Collection, Colors, EmbedBuilder } from "discord.js";
import { Command } from "../classes/command";
import { CommandContext } from "../classes/commandContext";

const commandData: ApplicationCommandData = {
    type: ApplicationCommandType.ChatInput,
    name: "viewhandout",
    description: "Shows the status of a handout",
    options: [{
        type: ApplicationCommandOptionType.String,
        name: "message_id",
        description: "The message id of the handout",
        required: false
    }]
}


export default class Test extends Command {
    constructor() {
        super(commandData)
        this.name = commandData.name
        this.staffOnly = true
        this.description = `Shows a handout`
    }
    async run(ctx: CommandContext): Promise<any> {
        let id = ctx.interaction.options.getString("message_id")
        if(id) {
            let res = await ctx.sql.query(`SELECT * FROM freekeys WHERE id=$1`, [id]).catch(() => null)
            if(!res || !res.rows.length) return ctx.error("Unable to find that handout")

            let claimed = res.rows.filter(r => r.user_id)
            let unclaimed = res.rows.filter(r => !r.user_id)

            let file = new AttachmentBuilder(Buffer.from(`Unclaimed keys (${unclaimed.length})\n-----------------${"-".repeat((unclaimed.length + "").length)}\n\n${unclaimed.map(r => r.prize).join("\n")}\n\n\nClaimed keys (${claimed.length})\n---------------${"-".repeat((claimed.length + "").length)}\n\n${(await Promise.all(claimed.map(async r => `${!!r.proof_url ? "✅" : "❌"} | ${r.prize} | ${r.user_id} | Key gotten at: ${r.received_at?.toISOString()} | Proof submitted at: ${r.proof_submitted_at?.toISOString() || "not yet                 "} | ${await ctx.client.users.fetch(r.user_id).then(res => res.username).catch(() => "Unknown")} | ${!!r.proof_url ? `SUBMITTED PROOF: ${r.proof_url}` : `${r.alert_send ? "Alert sent | " : ""}Days since gotten key: ${(Date.now() - new Date(r.received_at).getTime()) / (1000 * 60 * 60 * 24)}`}`))).join("\n")}`), {name: "keys.txt"})
            const csv = new AttachmentBuilder(
                Buffer.from(
                    `Key,Proof Submitted,User ID,Username,Key received at,Proof submitted at,Alert Sent
${unclaimed.map(k => `"${k.prize}","","","","","",""`).join("\n")}
${await Promise.all(claimed.map(async k => `"${k.prize}","${k.proof_url ? 'yes' : 'no'}","${k.user_id}","${await ctx.client.users.fetch(k.user_id).then(res => res.username).catch(() => "Unknown")}","${k.received_at?.toISOString() || ""}","${k.proof_submitted_at?.toISOString() || ""}","${k.alert_send ? 'yes' : 'no'}"`)).then(res => res.join("\n"))}`
                ),
                {
                    name: "keys.csv"
                }
            )

            let embed = new EmbedBuilder()
            .setColor(Colors.Aqua)
            .setTitle("Handout info:")
            .setDescription(`[${res.rows[0]?.name || "This handout"}](https://discord.com/channels/${ctx.interaction.guildId}/${res.rows[0].channel_id}/${res.rows[0].id})`)
            .addFields([
                {name: "**ID**", value: id, inline: true},
                {name: "**Given out**", value: `${res.rows.filter(r => r.user_id).length}/${res.rowCount}`, inline: true}
            ])
            
            ctx.reply({embeds: [embed], ephemeral: true, files: [file, csv]})
        } else {
            let res = await ctx.sql.query(`SELECT * FROM freekeys`)
            let unique = new Collection(res.rows.map(r => ([r.id, r])))
            let i = 0;
            let desc = `${unique.map((r, k) => `**${++i}** [${r.name || "click here"}](https://discord.com/channels/${ctx.interaction.guildId}/${r.channel_id}/${r.id}) ${res.rows.filter(ro => ro.id === k && ro.user_id).length}/${res.rows.filter(ro => ro.id === k).length} keys given out`).join("\n")}`

            if(desc.length > 4000) return ctx.reply({content: "Attached below", files: [new AttachmentBuilder(Buffer.from(desc), {name: "giveaways.txt"})], ephemeral: true})
            let embed = new EmbedBuilder()
            .setColor(Colors.Aqua)
            .setTitle("Handouts")
            .setDescription(desc || "No Handouts")
        
            ctx.reply({embeds: [embed], ephemeral: true})
        }
    }
}