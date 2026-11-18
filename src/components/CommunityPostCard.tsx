import React, { useState, memo } from 'react';
import {
  Send,
  User as UserIcon,
  Trash2,
  Heart,
  MessageCircle,
  CornerUpRight,
  Edit3,
  Check,
  X,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';
import { CommunityPost, PostComment } from '../lib/supabase';
import { toast } from '../lib/customToast';

export function parseCommentContent(content: string): { text: string; likes: number } {
  if (!content) return { text: '', likes: 0 };
  const match = content.match(/^(.*)\s+\[likes:(\d+)\]$/s);
  if (match) {
    return {
      text: match[1],
      likes: parseInt(match[2], 10),
    };
  }
  return { text: content, likes: 0 };
}

export function formatCommentContent(text: string, likes: number): string {
  if (likes <= 0) return text;
  return `${text} [likes:${likes}]`;
}

interface CommunityCommentItemProps {
  comment: PostComment;
  postId: string;
  isLiked: boolean;
  canManage: boolean;
  isImportMode: boolean;
  formattedDate: string;
  onPreviewAvatar: (url: string, userName: string) => void;
  onToggleLike: (postId: string, commentId: string, currentLikes: number) => void;
  onDirectLike: (postId: string, commentId: string, targetLikes: number, currentLikes: number) => void;
  onStartEdit: (commentId: string, postId: string, text: string) => void;
  onRequestDelete: (commentId: string, postId: string) => void;
}

const CommunityCommentItem = memo(function CommunityCommentItem({
  comment,
  postId,
  isLiked,
  canManage,
  isImportMode,
  formattedDate,
  onPreviewAvatar,
  onToggleLike,
  onDirectLike,
  onStartEdit,
  onRequestDelete,
}: CommunityCommentItemProps) {
  const { text, likes } = parseCommentContent(comment.content);
  const [isEditingLikes, setIsEditingLikes] = useState(false);
  const [likesStr, setLikesStr] = useState('');

  const handleAvatarClick = () => {
    if (comment.user_avatar_url) {
      onPreviewAvatar(comment.user_avatar_url, comment.user_name);
    } else {
      toast.info('Este usuário não possui foto de perfil cadastrada.');
    }
  };

  const commitLikes = () => {
    const val = parseInt(likesStr, 10);
    onDirectLike(postId, comment.id, isNaN(val) ? 0 : val, likes);
    setIsEditingLikes(false);
  };

  return (
    <div className="flex gap-3 items-start group/comment">
      <div
        className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/5 shrink-0 overflow-hidden cursor-pointer hover:opacity-85 active:scale-[0.95] transition-all"
        onClick={handleAvatarClick}
        title="Clique para ver a foto de perfil ampliada"
      >
        {comment.user_avatar_url && comment.user_avatar_url.trim() ? (
          <img
            src={comment.user_avatar_url.trim()}
            alt="Avatar"
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <UserIcon size={14} />
        )}
      </div>
      <div className="flex-1 flex items-start gap-2 justify-between">
        <div className="bg-zinc-800 rounded-2xl px-3 py-2 max-w-[85%] relative text-left">
          <div className="flex items-center justify-between gap-4 mb-0.5">
            <h5
              className={`font-bold text-[11px] cursor-pointer hover:underline ${
                isImportMode ? 'text-blue-500' : 'text-primary'
              }`}
              onClick={handleAvatarClick}
              title="Clique para ver a foto de perfil ampliada"
            >
              {comment.user_name}
            </h5>
            <span className="text-[9px] text-gray-500">{formattedDate}</span>
          </div>
          <p className="text-xs text-gray-300 break-words">{text}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 mt-1">
          {isEditingLikes ? (
            <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-lg p-1">
              <input
                type="number"
                value={likesStr}
                onChange={(e) => setLikesStr(e.target.value)}
                className="w-12 bg-zinc-950 border border-white/10 text-white rounded px-1 text-center font-semibold text-[10px] h-5 focus:outline-none focus:border-rose-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitLikes();
                  else if (e.key === 'Escape') setIsEditingLikes(false);
                }}
                autoFocus
              />
              <button
                onClick={commitLikes}
                className="text-emerald-400 hover:text-emerald-300 p-0.5"
                title="Salvar"
              >
                <Check size={12} />
              </button>
              <button
                onClick={() => setIsEditingLikes(false)}
                className="text-gray-400 hover:text-white p-0.5"
                title="Cancelar"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={() => onToggleLike(postId, comment.id, likes)}
                className="flex items-center gap-1 text-[10px] py-1 px-1.5 rounded-lg transition-all text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 active:scale-95 cursor-pointer"
                title="Clique para curtir ou remover curtida"
              >
                <Heart
                  size={12}
                  className={
                    isLiked
                      ? 'fill-rose-500 text-rose-500'
                      : likes > 0
                        ? 'text-rose-400'
                        : 'text-gray-500'
                  }
                />
                {likes > 0 && <span className="font-semibold">{likes}</span>}
              </button>

              {isImportMode && (
                <div className="flex items-center gap-1 bg-zinc-900/50 rounded-lg p-0.5 border border-white/5">
                  <button
                    onClick={() => onDirectLike(postId, comment.id, likes + 5, likes)}
                    className="text-[9px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-1 py-0.5 rounded font-mono transition-all font-semibold"
                    title="Adicionar 5 curtidas"
                  >
                    +5
                  </button>
                  <button
                    onClick={() => onDirectLike(postId, comment.id, likes + 10, likes)}
                    className="text-[9px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-1 py-0.5 rounded font-mono transition-all font-semibold"
                    title="Adicionar 10 curtidas"
                  >
                    +10
                  </button>
                  <button
                    onClick={() => {
                      setLikesStr(String(likes));
                      setIsEditingLikes(true);
                    }}
                    className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-white/5 transition-all"
                    title="Definir quantidade exata"
                  >
                    <Edit3 size={11} />
                  </button>
                </div>
              )}
            </>
          )}

          {canManage && (
            <button
              onClick={() => onStartEdit(comment.id, postId, text)}
              className={`text-gray-600 ${
                isImportMode ? 'hover:text-blue-500' : 'hover:text-primary'
              } transition-all p-1.5 shrink-0`}
              title="Editar comentário"
            >
              <Edit3 size={13} />
            </button>
          )}

          {canManage && (
            <button
              onClick={() => onRequestDelete(comment.id, postId)}
              className="text-gray-600 hover:text-red-500 transition-all p-1.5 shrink-0"
              title="Excluir comentário"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

export interface CommunityPostCardProps {
  post: CommunityPost;
  index: number;
  isLiked: boolean;
  isExpanded: boolean;
  postComments?: PostComment[];
  likedCommentsSet: Set<string>;
  currentUserId: string;
  isAdmin: boolean;
  isImportMode: boolean;
  showCommentAvatar: boolean;
  commentAvatarUrl: string | null;
  commentPlaceholder: string;
  commentDisabled: boolean;
  replyingToLabel: string;
  replyLabel: string;
  formatDate: (dateString?: string) => string;
  onPreviewAvatar: (url: string, userName: string) => void;
  onPreviewPostImage: (url: string) => void;
  onEditPost: (post: CommunityPost) => void;
  onDeletePost: (postId: string, imageUrl?: string | null) => void;
  onLikePost: (postId: string) => void;
  onDirectLikePost: (postId: string, targetLikes: number, currentLikes: number) => void;
  onToggleComments: (postId: string) => void;
  onReplyPost: (post: CommunityPost) => void;
  onAddComment: (postId: string, content: string) => void;
  onToggleLikeComment: (postId: string, commentId: string, currentLikes: number) => void;
  onDirectLikeComment: (postId: string, commentId: string, targetLikes: number, currentLikes: number) => void;
  onEditComment: (commentId: string, postId: string, text: string) => void;
  onDeleteComment: (commentId: string, postId: string) => void;
}

function arePostCardPropsEqual(prev: CommunityPostCardProps, next: CommunityPostCardProps): boolean {
  if (
    prev.post !== next.post ||
    prev.index !== next.index ||
    prev.isLiked !== next.isLiked ||
    prev.isExpanded !== next.isExpanded ||
    prev.currentUserId !== next.currentUserId ||
    prev.isAdmin !== next.isAdmin ||
    prev.isImportMode !== next.isImportMode ||
    prev.showCommentAvatar !== next.showCommentAvatar ||
    prev.commentAvatarUrl !== next.commentAvatarUrl ||
    prev.commentPlaceholder !== next.commentPlaceholder ||
    prev.commentDisabled !== next.commentDisabled ||
    prev.replyingToLabel !== next.replyingToLabel ||
    prev.replyLabel !== next.replyLabel ||
    prev.formatDate !== next.formatDate ||
    prev.onPreviewAvatar !== next.onPreviewAvatar ||
    prev.onPreviewPostImage !== next.onPreviewPostImage ||
    prev.onEditPost !== next.onEditPost ||
    prev.onDeletePost !== next.onDeletePost ||
    prev.onLikePost !== next.onLikePost ||
    prev.onDirectLikePost !== next.onDirectLikePost ||
    prev.onToggleComments !== next.onToggleComments ||
    prev.onReplyPost !== next.onReplyPost ||
    prev.onAddComment !== next.onAddComment ||
    prev.onToggleLikeComment !== next.onToggleLikeComment ||
    prev.onDirectLikeComment !== next.onDirectLikeComment ||
    prev.onEditComment !== next.onEditComment ||
    prev.onDeleteComment !== next.onDeleteComment
  ) {
    return false;
  }

  // Only inspect comments and comment-likes if this card is expanded
  if (next.isExpanded) {
    if (prev.postComments !== next.postComments || prev.likedCommentsSet !== next.likedCommentsSet) {
      return false;
    }
  }

  return true;
}

export const CommunityPostCard = memo(function CommunityPostCard({
  post,
  index,
  isLiked,
  isExpanded,
  postComments,
  likedCommentsSet,
  currentUserId,
  isAdmin,
  isImportMode,
  showCommentAvatar,
  commentAvatarUrl,
  commentPlaceholder,
  commentDisabled,
  replyingToLabel,
  replyLabel,
  formatDate,
  onPreviewAvatar,
  onPreviewPostImage,
  onEditPost,
  onDeletePost,
  onLikePost,
  onDirectLikePost,
  onToggleComments,
  onReplyPost,
  onAddComment,
  onToggleLikeComment,
  onDirectLikeComment,
  onEditComment,
  onDeleteComment,
}: CommunityPostCardProps) {
  const [commentDraft, setCommentDraft] = useState('');
  const [isEditingPostLikes, setIsEditingPostLikes] = useState(false);
  const [postLikesStr, setPostLikesStr] = useState('');

  const handleSubmitComment = () => {
    if (commentDisabled) return;
    const trimmed = commentDraft.trim();
    if (!trimmed) return;
    setCommentDraft('');
    onAddComment(post.id, trimmed);
  };

  const commitPostLikes = () => {
    const val = parseInt(postLikesStr, 10);
    onDirectLikePost(post.id, isNaN(val) ? 0 : val, post.likes_count || 0);
    setIsEditingPostLikes(false);
  };

  return (
    <div className="content-visibility-auto group/post relative rounded-2xl p-[1px] bg-gradient-to-b from-white/15 via-white/[0.06] to-white/[0.02] hover:from-amber-400/35 hover:via-primary/20 hover:to-white/5 transition-all duration-500 shadow-[0_8px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(245,158,11,0.08)] overflow-hidden">
      {/* Top Hairline Light Reflection */}
      <div className="absolute top-0 inset-x-6 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover/post:via-amber-300/50 transition-colors pointer-events-none z-20" />

      <div className="relative w-full bg-[#11131a] rounded-[15px] overflow-hidden flex flex-col">
        {/* Post Header */}
        <div className="p-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer hover:opacity-85 active:scale-[0.98] transition-all"
            onClick={() => {
              if (post.user_avatar_url) {
                onPreviewAvatar(post.user_avatar_url, post.user_name);
              } else {
                toast.info('Este usuário não possui foto de perfil cadastrada.');
              }
            }}
            title="Clique para ver a foto de perfil ampliada"
          >
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 border border-white/10 overflow-hidden shrink-0">
              {post.user_avatar_url && post.user_avatar_url.trim() ? (
                <img
                  src={post.user_avatar_url.trim()}
                  alt="Avatar"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <UserIcon size={20} />
              )}
            </div>
            <div>
              <h4 className="font-bold text-sm hover:underline">{post.user_name}</h4>
              <p className="text-[10px] text-gray-500">{formatDate(post.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={() => onEditPost(post)}
                className={`text-gray-600 ${
                  isImportMode ? 'hover:text-blue-500' : 'hover:text-primary'
                } transition-colors p-1`}
              >
                <Edit3 size={16} />
              </button>
            )}
            {(post.user_id === currentUserId || isImportMode) && (
              <button
                onClick={() => onDeletePost(post.id, post.image_url)}
                className="text-gray-600 hover:text-red-500 transition-colors p-1"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Reply Context */}
        {post.reply_to_id && (
          <div className="px-4 pb-2">
            <div
              className={`bg-white/5 rounded-xl p-3 border-l-4 ${
                isImportMode ? 'border-blue-500/50' : 'border-primary/50'
              }`}
            >
              <p
                className={`text-[10px] ${
                  isImportMode ? 'text-blue-500/70' : 'text-primary/70'
                } font-bold mb-1 uppercase tracking-wider`}
              >
                {replyingToLabel} {post.reply_to_user_name}
              </p>
              <p className="text-xs text-gray-500 line-clamp-1 italic">"{post.reply_to_content}"</p>
            </div>
          </div>
        )}

        {/* Post Content */}
        <div className="px-4 pb-4">
          <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{post.content}</p>
        </div>

        {/* Post Image */}
        {post.image_url && post.image_url.trim() && (
          <div
            className="bg-black/20 border-y border-white/5 cursor-zoom-in"
            onClick={() => onPreviewPostImage(post.image_url!)}
          >
            <img
              src={post.image_url.trim()}
              loading={index < 2 ? 'eager' : 'lazy'}
              decoding="async"
              className="w-full max-h-[500px] object-contain"
              alt="Post"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Post Actions */}
        <div className="px-4 py-3 flex items-center gap-6 border-t border-white/5">
          {isEditingPostLikes ? (
            <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-lg p-1">
              <input
                type="number"
                value={postLikesStr}
                onChange={(e) => setPostLikesStr(e.target.value)}
                className="w-16 bg-zinc-950 border border-white/10 text-white rounded px-1.5 text-center font-semibold text-xs h-6 focus:outline-none focus:border-rose-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPostLikes();
                  else if (e.key === 'Escape') setIsEditingPostLikes(false);
                }}
                autoFocus
              />
              <button
                onClick={commitPostLikes}
                className="text-emerald-400 hover:text-emerald-300 p-0.5"
                title="Salvar"
              >
                <Check size={14} />
              </button>
              <button
                onClick={() => setIsEditingPostLikes(false)}
                className="text-gray-400 hover:text-white p-0.5"
                title="Cancelar"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onLikePost(post.id)}
                className={`flex items-center gap-2 text-sm font-bold transition-all active:scale-95 ${
                  isLiked
                    ? isImportMode
                      ? 'text-blue-500'
                      : 'text-primary'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={isImportMode ? 'Clique para curtir ou remover curtida' : undefined}
              >
                <Heart size={20} className={isLiked ? 'fill-current' : ''} />
                <span>{post.likes_count || 0}</span>
              </button>

              {isImportMode && (
                <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5 border border-white/5 ml-1">
                  <button
                    onClick={() =>
                      onDirectLikePost(post.id, (post.likes_count || 0) + 5, post.likes_count || 0)
                    }
                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-1.5 py-0.5 rounded font-mono transition-all font-semibold"
                    title="Adicionar 5 curtidas"
                  >
                    +5
                  </button>
                  <button
                    onClick={() =>
                      onDirectLikePost(post.id, (post.likes_count || 0) + 10, post.likes_count || 0)
                    }
                    className="text-[10px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-1.5 py-0.5 rounded font-mono transition-all font-semibold"
                    title="Adicionar 10 curtidas"
                  >
                    +10
                  </button>
                  <button
                    onClick={() => {
                      setPostLikesStr(String(post.likes_count || 0));
                      setIsEditingPostLikes(true);
                    }}
                    className="text-zinc-400 hover:text-zinc-200 p-1 rounded hover:bg-white/5 transition-all"
                    title="Definir quantidade exata de curtidas"
                  >
                    <Edit3 size={12} />
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => onToggleComments(post.id)}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold transition-all active:scale-95"
          >
            <MessageCircle size={20} />
            <span>{post.comments_count || 0}</span>
          </button>

          <button
            onClick={() => onReplyPost(post)}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold transition-all active:scale-95 ml-auto"
          >
            <CornerUpRight size={20} />
            <span className="hidden sm:inline">{replyLabel}</span>
          </button>
        </div>

        {/* Comments Section */}
        <AnimatePresence>
          {isExpanded && (
            <m.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-black/20 border-t border-white/5"
            >
              <div className="p-4 space-y-4">
                <div className="space-y-3">
                  {postComments?.map((comment) => (
                    <CommunityCommentItem
                      key={comment.id}
                      comment={comment}
                      postId={post.id}
                      isLiked={likedCommentsSet.has(comment.id)}
                      canManage={comment.user_id === currentUserId || isImportMode || isAdmin}
                      isImportMode={isImportMode}
                      formattedDate={formatDate(comment.created_at)}
                      onPreviewAvatar={onPreviewAvatar}
                      onToggleLike={onToggleLikeComment}
                      onDirectLike={onDirectLikeComment}
                      onStartEdit={onEditComment}
                      onRequestDelete={onDeleteComment}
                    />
                  ))}
                </div>

                {/* Add Comment Input */}
                <div className="space-y-3 pt-2">
                  <div className="flex gap-3">
                    {showCommentAvatar && (
                      <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/5 shrink-0 overflow-hidden">
                        {commentAvatarUrl && commentAvatarUrl.trim() ? (
                          <img
                            src={commentAvatarUrl.trim()}
                            alt="Avatar"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <UserIcon size={14} />
                        )}
                      </div>
                    )}
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
                        placeholder={commentPlaceholder}
                        disabled={commentDisabled}
                        className={`w-full bg-zinc-800 border border-white/10 rounded-full px-4 py-2 pr-10 text-xs focus:outline-none ${
                          isImportMode ? 'focus:border-blue-500' : 'focus:border-primary'
                        } disabled:opacity-50`}
                        style={{ fontSize: '16px' }}
                      />
                      <button
                        onClick={handleSubmitComment}
                        disabled={commentDisabled}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 ${
                          isImportMode
                            ? 'text-blue-500 hover:text-blue-600'
                            : 'text-primary hover:text-primary-hover'
                        } disabled:opacity-50`}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}, arePostCardPropsEqual);
