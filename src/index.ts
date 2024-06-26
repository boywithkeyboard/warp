import { getBooleanInput, getInput, setFailed } from '@actions/core'
import { fetchTrace } from 'cdn-cgi-trace'
import { execSync } from 'node:child_process'
import { platform } from 'node:os'
import { wait } from './wait'

try {
  async function action() {
    const onlyDoH = getBooleanInput('onlyDoH')
    const familyMode = getInput('familyMode')

    if (/^off|malware|full$/.test(familyMode) === false) {
      throw new Error('Bad option: familyMode')
    }

    if (platform() !== 'linux') {
      throw new Error('This action is only available for Linux!')
    }

    // add cloudflare gpg key
    console.log('Adding Cloudflare\'s GPG key...')
    execSync('curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg')

    // add repo to apt repos
    console.log('Adding repository...')
    execSync('echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list')

    // install warp
    console.log('Installing WARP...')
    execSync('sudo apt-get -y update && sudo apt-get install -y cloudflare-warp')

    // setup warp
    console.log('Setting up WARP...')
    execSync('sudo warp-cli --accept-tos registration new')
    execSync(`sudo warp-cli --accept-tos mode ${onlyDoH ? 'doh' : 'warp+doh'}`)
    execSync(`sudo warp-cli --accept-tos dns families ${familyMode}`)
    execSync('sudo warp-cli --accept-tos connect')

    // verify installation
    console.log('Verifying installation...')
    await wait(1000)

    const trace = await fetchTrace('cloudflare.com')

    if (trace.warp === 'off') {
      throw new Error('WARP could NOT be enabled!')
    }

    console.log('WARP was successfully enabled!')
  }

  action()
} catch (err) {
  setFailed(
    err instanceof Error
      ? err.message
      : 'Something unexpected happened.'
  )
}
