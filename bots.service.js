const fs = require('fs');
const request = require('superagent');
const crypto = require('crypto');
const Promise = require('bluebird');

const {
  CSML_CLIENT_API_KEY,
  CSML_CLIENT_API_SECRET,
  CSML_CLIENT_URL,
} = process.env;

class BotsService {
  /**
   * Get airules of a bot
   * 
   * @async
   * @returns array
   */
  static async getRepoAirules() {
    if (fs.existsSync('airules')) return JSON.parse(fs.readFileSync('airules/airules.json'));
    return [];
  }

  /**
   * Get flows of a bot
   * @async
   * @returns array
   */
  static async getRepoFlows() {
    if (fs.existsSync('flows')) {
      return fs.readdirSync('flows').map(file_name => {
        return JSON.parse(fs.readFileSync(`flows/${file_name}`));
      })
    }
    return [];
  }

  /**
   * Create the signature to authentify call towards csml client's api
   * 
   * @returns array
   */
  static setAuthenticationHeader() {
    const UNIX_TIMESTAMP = Math.floor(Date.now() / 1000);
    const XApiKey = `${CSML_CLIENT_API_KEY}|${UNIX_TIMESTAMP}`;
    const signature = crypto.createHmac('sha256', CSML_CLIENT_API_SECRET)
      .update(XApiKey, 'utf-8')
      .digest('hex');
    const XApiSignature = `sha256=${signature}`;
    return [XApiKey, XApiSignature];
  }

  /**
   * Build the bot via the studio client API
   */
  static async buildBot() {
    const [XApiKey, XApiSignature] = BotsService.setAuthenticationHeader();

    await request.post(`${CSML_CLIENT_URL}/api/bot/build`)
      .set('X-Api-Key', XApiKey)
      .set('X-Api-Signature', XApiSignature)
      .send();
  }

  /** 
   * Sync the flows and airule from the repository to the csml studio.
   */
  static async saveBot() {
    const [XApiKey, XApiSignature] = BotsService.setAuthenticationHeader();

    const flows = await BotsService.getRepoFlows();
    const airules = await BotsService.getRepoAirules();

    const studio_bot_flows = await request.get(`${CSML_CLIENT_URL}/api/bot/flows`)
      .set('X-Api-Key', XApiKey)
      .set('X-Api-Signature', XApiSignature)
      .then(res => res.body);

    const delete_flows = [];
    const update_flows = [];
    const create_flows = [];

    studio_bot_flows.forEach(studio_flow => {
      const found = flows.find(f => f.name === studio_flow.name);
      if (found) update_flows.push({ ...studio_flow, ...found });
      else delete_flows.push(studio_flow);
    });

    flows.forEach(f => {
      const found = studio_bot_flows.find(sf => sf.name === f.name);
      if (!found) create_flows.push(f);
    })

    if (delete_flows.length) {
      await Promise.each(delete_flows, async df => {
        await request.del(`${CSML_CLIENT_URL}/api/bot/flows/${df.id}`)
          .set('X-Api-Key', XApiKey)
          .set('X-Api-Signature', XApiSignature)
          .send(df);
      });
    }

    if (update_flows.length) {
      await Promise.each(update_flows, async uf => {
        await request.put(`${CSML_CLIENT_URL}/api/bot/flows/${uf.id}`)
          .set('X-Api-Key', XApiKey)
          .set('X-Api-Signature', XApiSignature)
          .send(uf);
      });
    }

    if (create_flows.length) {
      await Promise.each(create_flows, async cf => {
        await request.post(`${CSML_CLIENT_URL}/api/bot/flows`)
          .set('X-Api-Key', XApiKey)
          .set('X-Api-Signature', XApiSignature)
          .send(cf);
      });
    }

    if (airules) {
      await request.put(`${CSML_CLIENT_URL}/api/bot`)
        .set('X-Api-Key', XApiKey)
        .set('X-Api-Signature', XApiSignature)
        .send({ airules });
    }
  }

  /**
   * Create a label 
   * 
   * @param {string} label_name
   */
  static async createLabel(label_name) {
    const [XApiKey, XApiSignature] = BotsService.setAuthenticationHeader();

    return request.post(`${CSML_CLIENT_URL}/api/bot/label`)
      .set('X-Api-Key', XApiKey)
      .set('X-Api-Signature', XApiSignature)
      .send({ label: label_name })
      .then(res => res.body);
  }

  /**
   * Delete a label 
   * 
   * @param {string} label_name
   */
  static async deleteLabel(label_name) {
    const [XApiKey, XApiSignature] = BotsService.setAuthenticationHeader();

    return request.del(`${CSML_CLIENT_URL}/api/bot/label/${label_name}`)
      .set('X-Api-Key', XApiKey)
      .set('X-Api-Signature', XApiSignature)
      .then(res => res.body);
  }
}

module.exports = { BotsService };