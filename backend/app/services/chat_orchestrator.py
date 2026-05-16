from app.models.schemas import ChatRequest, ChatResponse, Message
from app.services.chat_service import (
    needs_clarification,
    clarification_response,
    is_comparison_query,
    is_off_topic,
    refusal_response,
)
from app.services.context_builder import build_retrieval_query, build_search_query
from app.services.groq_client import (
    generate_clarification_reply,
    generate_comparison_reply,
    generate_reply,
)
from app.rag.retriever import retrieve
from app.services.recommendation_engine import (
    filter_docs_for_primary_tech,
    format_recommendations,
    prioritize_results,
)

MAX_RECOMMENDATIONS = 10
MAX_CONVERSATION_TURNS = 8


def _user_turn_count(messages: list) -> int:
    return sum(1 for m in messages if m.role == "user")


def process_chat(request: ChatRequest, *, for_voice: bool = False) -> ChatResponse:
    """Shared chat pipeline for REST /chat and voice WebSocket flows."""
    conversation_text = "\n".join(
        f"{msg.role}: {msg.content}" for msg in request.messages
    )
    search_query = build_search_query(request.messages)
    retrieval_query = build_retrieval_query(request.messages)
    latest = request.messages[-1].content if request.messages else ""
    user_turns = _user_turn_count(request.messages)

    if user_turns > MAX_CONVERSATION_TURNS:
        return ChatResponse(
            reply=(
                "We've covered a lot in this session. "
                "Please review the recommendations above, or start a new conversation."
            ),
            recommendations=[],
            end_of_conversation=True,
        )

    if is_off_topic(latest):
        return ChatResponse(
            reply=refusal_response(),
            recommendations=[],
            end_of_conversation=False,
        )

    if is_comparison_query(search_query):
        docs = retrieve(search_query)
        docs = prioritize_results(search_query, docs)
        recommendations = format_recommendations(docs)[:MAX_RECOMMENDATIONS]
        reply = generate_comparison_reply(conversation_text, docs[:5])
        return ChatResponse(
            reply=reply,
            recommendations=recommendations if recommendations else [],
            end_of_conversation=False,
        )

    prior_user = " ".join(
        m.content for m in request.messages[:-1] if m.role == "user"
    )
    clarify_query = retrieval_query if user_turns > 1 else search_query
    if needs_clarification(
        clarify_query,
        user_turns=user_turns,
        conversation_context=prior_user,
    ):
        reply = generate_clarification_reply(conversation_text)
        return ChatResponse(
            reply=reply or clarification_response(),
            recommendations=[],
            end_of_conversation=False,
        )

    docs = retrieve(retrieval_query)
    docs = prioritize_results(retrieval_query, docs)
    docs = filter_docs_for_primary_tech(retrieval_query, docs)
    limit = 5 if for_voice else MAX_RECOMMENDATIONS
    recommendations = format_recommendations(docs)[:limit]

    if not recommendations:
        return ChatResponse(
            reply=(
                "I could not find matching SHL assessments for that request. "
                "Could you share the role, seniority, and skills you need to assess?"
            ),
            recommendations=[],
            end_of_conversation=False,
        )

    reply = generate_reply(
        conversation_text,
        recommendations,
        voice=for_voice,
        latest_user_message=latest,
    )
    end = len(recommendations) > 0 and not needs_clarification(
        clarify_query,
        user_turns=user_turns,
        conversation_context=prior_user,
    )

    return ChatResponse(
        reply=reply,
        recommendations=recommendations,
        end_of_conversation=end,
    )


def messages_from_voice_history(
    history: list[dict],
    user_utterance: str,
) -> list[Message]:
    """Build ChatRequest messages from prior voice turns plus new utterance."""
    messages = [Message(role=m["role"], content=m["content"]) for m in history]
    messages.append(Message(role="user", content=user_utterance))
    return messages
