class Clawpay < Formula
  desc "Open-source Stripe MCP Server for AI Agents"
  homepage "https://github.com/xodn348/clawpay"
  url "https://registry.npmjs.org/clawpay/-/clawpay-0.1.0.tgz"
  sha256 "placeholder_sha256"
  license "Apache-2.0"
  depends_on "node"

  def install
    system "npm", "install", *Language::Node.std_npm_install_args(libexec)
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match "clawpay", shell_output("#{bin}/clawpay --help 2>&1", 1)
  end
end
