import type { Metadata } from "next";
import { headers } from "next/headers";
import { CheckCircle2, ExternalLink, Link2, Send, Share2, XCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/admin/auth";
import { hasPermission } from "@/lib/admin/rbac";
import { formatDate } from "@/lib/admin/format";
import { paramFrom } from "@/lib/admin/queries";
import { SITE_URL } from "@/lib/seo";
import { listArticleOptions, listSocialAccounts, listSocialPosts, type SocialAccountView } from "@/lib/admin/social/accounts";
import { isCopyWriterConfigured } from "@/lib/admin/social/copy";
import { PLATFORM_INFO, SOCIAL_PLATFORMS, callbackUrl, missingEnv, type SocialPlatform } from "@/lib/admin/social/platforms";
import { disconnectSocialAccount } from "@/app/admin/actions-social";
import { Callout, DbUnavailable, EmptyState, PageHeader, Panel, Pill, btn, tdClass, thClass, trClass } from "@/components/admin/ui";
import { ConfirmButton } from "@/components/admin/SubmitButton";
import { SocialComposer } from "@/components/admin/SocialComposer";

export const metadata: Metadata = { title: "Social" };

const EXPIRY_WARNING_DAYS = 10;

/** The origin this admin is being used on, for the callback URLs shown in setup steps. */
async function currentOrigin(): Promise<string> {
  if (process.env.NODE_ENV === "production") return SITE_URL;
  const host = (await headers()).get("host");
  return host ? `http://${host}` : SITE_URL;
}

function ExpiryPill({ account }: { account: SocialAccountView }) {
  const days = account.daysLeft;
  if (days === null || !account.expiresAt) return <Pill tone="green">Does not expire</Pill>;
  if (days < 0) return <Pill tone="red">Expired {formatDate(account.expiresAt)}</Pill>;
  return <Pill tone={days <= EXPIRY_WARNING_DAYS ? "amber" : "green"}>{days === 0 ? "Expires today" : `${days} days left`}</Pill>;
}

function PlatformCard({
  platform,
  accounts,
  origin,
  canManage,
}: {
  platform: SocialPlatform;
  accounts: SocialAccountView[];
  origin: string;
  canManage: boolean;
}) {
  const info = PLATFORM_INFO[platform];
  const missing = missingEnv(platform);
  const connected = accounts.length > 0;
  const needsReconnect = accounts.some((a) => a.daysLeft !== null && a.daysLeft <= EXPIRY_WARNING_DAYS);
  const connectHref = `/api/admin/social/${platform.toLowerCase()}/connect`;

  return (
    <Panel
      title={info.label}
      description={`Post to your ${info.label} ${info.target}.`}
      actions={
        connected ? (
          <Pill tone="green">
            <CheckCircle2 className="h-3 w-3" /> Connected
          </Pill>
        ) : (
          <Pill tone="slate">Not connected</Pill>
        )
      }
    >
      {connected && (
        <ul className="mb-4 divide-y divide-slate-100">
          {accounts.map((account) => (
            <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{account.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Connected by {account.connectedBy} on {formatDate(account.updatedAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ExpiryPill account={account} />
                {canManage && (
                  <form action={disconnectSocialAccount}>
                    <input type="hidden" name="id" value={account.id} />
                    <ConfirmButton
                      variant="ghost"
                      message={`Disconnect ${account.name}? Posts already published stay on ${info.label}.`}
                      className="hover:text-red-600"
                    >
                      Disconnect
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {missing.length > 0 ? (
        <Callout tone="amber" title={`${info.label} is not set up on the server yet`}>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>
              Create or open your app at{" "}
              <a href={info.consoleUrl} target="_blank" rel="noreferrer" className="font-semibold text-cyan-700 underline">
                {info.consoleLabel}
              </a>
              .
            </li>
            <li>
              In {info.callbackSetting}, add: <code className="break-all rounded bg-white px-1.5 py-0.5 text-xs text-slate-900">{callbackUrl(origin, platform)}</code>
            </li>
            <li>
              Add these to the server&apos;s environment variables, then redeploy:{" "}
              <code className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-900">{missing.join(", ")}</code>
            </li>
          </ol>
        </Callout>
      ) : canManage ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* A plain link: the flow leaves the site, so it must be a full page navigation. */}
          <a href={connectHref} className={connected && !needsReconnect ? btn.secondary : btn.primary}>
            <Link2 className="h-4 w-4" />
            {connected ? `Reconnect ${info.label}` : `Connect ${info.label}`}
          </a>
          <p className="min-w-0 flex-1 text-xs text-slate-500">
            {info.label} must allow this address in {info.callbackSetting}:{" "}
            <code className="break-all text-slate-700">{callbackUrl(origin, platform)}</code>
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Only an admin can connect or disconnect accounts.</p>
      )}
    </Panel>
  );
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdminPage("social.post");
  const canManage = hasPermission(session.role, "social.manage");
  const params = await searchParams;
  const connectedNote = paramFrom(params.connected);
  const errorNote = paramFrom(params.error);

  const [accounts, posts, articles, origin] = await Promise.all([
    listSocialAccounts(),
    listSocialPosts(),
    listArticleOptions(),
    currentOrigin(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Growth"
        title="Social"
        description="Connect the company's LinkedIn and Facebook, draft a short post with AI, and publish it to both from here."
      />

      {connectedNote && (
        <Callout tone="green" icon={CheckCircle2} className="mb-6" title={`${paramFrom(params.platform) || "Account"} connected`}>
          {connectedNote} can now be published to from this page.
        </Callout>
      )}
      {errorNote && (
        <Callout tone="red" icon={XCircle} className="mb-6" title="The connection did not complete">
          {errorNote}
        </Callout>
      )}

      {!accounts.ok ? (
        <DbUnavailable error={accounts.error} />
      ) : (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {SOCIAL_PLATFORMS.map((platform) => (
              <PlatformCard
                key={platform}
                platform={platform}
                accounts={accounts.data.filter((a) => a.platform === platform)}
                origin={origin}
                canManage={canManage}
              />
            ))}
          </div>

          <Panel
            title="Write a post"
            description="Pick what the post is about, let the AI draft about 100 words, edit it, then publish."
            className="mb-6"
          >
            {accounts.data.length === 0 ? (
              <EmptyState
                icon={Share2}
                title="Connect an account first"
                description="Once LinkedIn or Facebook is connected above, you can write and publish posts here."
              />
            ) : (
              <SocialComposer
                accounts={accounts.data}
                articles={articles.ok ? articles.data : []}
                aiReady={isCopyWriterConfigured()}
                siteUrl={SITE_URL}
              />
            )}
          </Panel>

          <Panel title="Recent posts" description="Everything published from this page, newest first." bodyClassName="p-0">
            {!posts.ok ? (
              <div className="p-5">
                <DbUnavailable error={posts.error} />
              </div>
            ) : posts.data.length === 0 ? (
              <EmptyState icon={Send} title="Nothing published yet" description="Posts you publish from this page are listed here, with a link to each one." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px]">
                  <thead>
                    <tr>
                      <th className={thClass}>Published</th>
                      <th className={thClass}>Account</th>
                      <th className={thClass}>Post</th>
                      <th className={thClass}>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.data.map((post) => (
                      <tr key={post.id} className={trClass}>
                        <td className={`${tdClass} whitespace-nowrap text-slate-500`}>
                          {formatDate(post.createdAt)}
                          <span className="block text-xs">{post.createdBy}</span>
                        </td>
                        <td className={tdClass}>
                          <span className="font-semibold text-slate-900">{post.accountName}</span>
                          <span className="block text-xs text-slate-500">
                            {PLATFORM_INFO[post.platform as SocialPlatform]?.label ?? post.platform}
                          </span>
                        </td>
                        <td className={`${tdClass} max-w-md text-slate-700`}>
                          <p className="line-clamp-3 whitespace-pre-line">{post.text}</p>
                        </td>
                        <td className={tdClass}>
                          {post.status === "PUBLISHED" ? (
                            <>
                              <Pill tone="green">Published</Pill>
                              {post.permalink && (
                                <a
                                  href={post.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline"
                                >
                                  View post <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </>
                          ) : (
                            <>
                              <Pill tone="red">Failed</Pill>
                              {post.error && <p className="mt-1.5 max-w-xs text-xs text-red-600">{post.error}</p>}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
