/**
 * afterPack hook — embeds the custom icon into Writer.exe using rcedit.
 *
 * signAndEditExecutable: false in electron-builder.yml disables both code
 * signing AND rcedit. This hook runs rcedit separately so the icon is set
 * without requiring a code-signing certificate or elevated privileges.
 */

const { execFileSync } = require("child_process");
const path = require("path");

module.exports = async function afterPack({ appOutDir, packager }) {
  if (packager.platform.name !== "windows") return;

  const rcedit = path.resolve(
    __dirname,
    "../../../node_modules/electron-winstaller/vendor/rcedit.exe"
  );
  const exe = path.join(appOutDir, `${packager.appInfo.productName}.exe`);
  const icon = path.resolve(__dirname, "../build-resources/icon.ico");

  execFileSync(rcedit, [exe, "--set-icon", icon]);
  console.log(`  • icon applied to ${path.basename(exe)}`);
};
