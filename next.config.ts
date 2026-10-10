import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config,{webpack}) {
    if(process.env.ENT_DEPLOY_TARGET==='vercel'){
      config.resolve.alias['cloudflare:workers']=`${process.cwd()}/lib/vercel-runtime.ts`;
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/,`${process.cwd()}/lib/vercel-runtime.ts`));
    }
    return config;
  },
};

export default nextConfig;
