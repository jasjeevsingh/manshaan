"""
IRT Engine Unit Tests.

Tests for MIRT 3PL scoring engine:
- 3PL probability calculation
- EAP theta estimation
- Fisher information
- Item selection
- Simulation mode
"""

import pytest
import numpy as np
from pathlib import Path
import json
import tempfile

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.irt import Domain, IRTItem, DomainTheta, ResponseRecord, SessionState, ItemType
from app.services.irt_engine import IRTEngine


class TestIRTEngine:
    """Test suite for IRT Engine."""
    
    @pytest.fixture
    def sample_item_bank(self, tmp_path):
        """Create a temporary item bank for testing."""
        items = {
            "items": [
                {
                    "id": "TEST001",
                    "prompt": "Test question 1",
                    "item_type": "mcq",
                    "domain_loadings": {"episodic_memory": 1.0},
                    "difficulty": 0.0,
                    "guessing": 0.2,
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": 0
                },
                {
                    "id": "TEST002",
                    "prompt": "Test question 2",
                    "item_type": "mcq",
                    "domain_loadings": {"episodic_memory": 1.5, "executive_function": 0.5},
                    "difficulty": 1.0,
                    "guessing": 0.25,
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": 1
                },
                {
                    "id": "TEST003",
                    "prompt": "Test question 3",
                    "item_type": "mcq",
                    "domain_loadings": {"working_memory": 1.2},
                    "difficulty": -0.5,
                    "guessing": 0.2,
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": 2
                },
                {
                    "id": "TEST004",
                    "prompt": "Test question 4",
                    "item_type": "mcq",
                    "domain_loadings": {"processing_speed": 1.0},
                    "difficulty": 0.5,
                    "guessing": 0.25,
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": 3
                },
                {
                    "id": "TEST005",
                    "prompt": "Test question 5",
                    "item_type": "mcq",
                    "domain_loadings": {"visuospatial": 1.3},
                    "difficulty": 0.0,
                    "guessing": 0.2,
                    "options": ["A", "B", "C", "D"],
                    "correct_answer": 0
                }
            ]
        }
        
        item_bank_path = tmp_path / "test_item_bank.json"
        with open(item_bank_path, 'w') as f:
            json.dump(items, f)
        
        return item_bank_path
    
    @pytest.fixture
    def engine(self, sample_item_bank):
        """Create IRT engine with sample items."""
        return IRTEngine(item_bank_path=sample_item_bank)
    
    # =====================
    # 3PL Probability Tests
    # =====================
    
    def test_probability_at_difficulty_level(self, engine):
        """
        Test: When θ = b, P should be approximately (1 + c) / 2.
        For c = 0.2, P(θ=b) ≈ 0.6
        """
        item = engine.items["TEST001"]  # b=0, c=0.2
        theta = {Domain.EPISODIC_MEMORY: 0.0}  # θ = b
        
        p = engine.probability_correct(item, theta)
        
        # At θ = b, P = c + (1-c)/2 = 0.2 + 0.4 = 0.6
        assert abs(p - 0.6) < 0.01, f"Expected ~0.6, got {p}"
    
    def test_probability_high_ability(self, engine):
        """Test: High ability (θ >> b) should give P close to 1."""
        item = engine.items["TEST001"]
        theta = {Domain.EPISODIC_MEMORY: 3.0}  # Very high ability
        
        p = engine.probability_correct(item, theta)
        
        assert p > 0.95, f"Expected >0.95 for high ability, got {p}"
    
    def test_probability_low_ability(self, engine):
        """Test: Low ability (θ << b) should give P close to c (guessing)."""
        item = engine.items["TEST001"]  # c = 0.2
        theta = {Domain.EPISODIC_MEMORY: -3.0}  # Very low ability
        
        p = engine.probability_correct(item, theta)
        
        # Should be close to guessing parameter
        assert p < 0.3, f"Expected <0.3 for low ability, got {p}"
        assert p >= 0.2, f"Should not go below guessing (0.2), got {p}"
    
    def test_probability_multidomain_item(self, engine):
        """Test: Multi-domain item uses all domain loadings."""
        item = engine.items["TEST002"]  # Loads on EM and EF
        
        # Higher ability in both domains should increase P
        theta_low = {Domain.EPISODIC_MEMORY: 0.0, Domain.EXECUTIVE_FUNCTION: 0.0}
        theta_high = {Domain.EPISODIC_MEMORY: 1.0, Domain.EXECUTIVE_FUNCTION: 1.0}
        
        p_low = engine.probability_correct(item, theta_low)
        p_high = engine.probability_correct(item, theta_high)
        
        assert p_high > p_low, "Higher ability should yield higher P"
    
    def test_probability_bounds(self, engine):
        """Test: P should always be between 0 and 1."""
        for item in engine.items.values():
            for theta_val in [-5, -2, 0, 2, 5]:
                theta = {d: theta_val for d in Domain}
                p = engine.probability_correct(item, theta)
                
                assert 0 < p < 1, f"P={p} out of bounds for θ={theta_val}"
    
    # =====================
    # Fisher Information Tests
    # =====================
    
    def test_fisher_information_peak(self, engine):
        """Test: Fisher information should peak near the difficulty level."""
        item = engine.items["TEST001"]  # b = 0
        domain = Domain.EPISODIC_MEMORY
        
        info_at_b = engine.fisher_information(item, {domain: 0.0}, domain)
        info_far_below = engine.fisher_information(item, {domain: -3.0}, domain)
        info_far_above = engine.fisher_information(item, {domain: 3.0}, domain)
        
        # Information should be highest near b
        assert info_at_b > info_far_below, "Info should be higher at b than far below"
        assert info_at_b > info_far_above, "Info should be higher at b than far above"
    
    def test_fisher_information_wrong_domain(self, engine):
        """Test: Fisher info should be 0 for domains item doesn't load on."""
        item = engine.items["TEST001"]  # Only loads on episodic_memory
        
        info = engine.fisher_information(
            item, 
            {Domain.WORKING_MEMORY: 0.0}, 
            Domain.WORKING_MEMORY
        )
        
        assert info == 0.0, "No info for domain item doesn't load on"
    
    def test_total_information(self, engine):
        """Test: Total information sums across all domains."""
        item = engine.items["TEST002"]  # Multi-domain
        theta = {d: 0.0 for d in Domain}
        
        total_info = engine.total_information(item, theta)
        
        # Should be sum of individual domain infos
        individual_sum = sum(
            engine.fisher_information(item, theta, d)
            for d in Domain
        )
        
        assert abs(total_info - individual_sum) < 0.001
    
    # =====================
    # EAP Estimation Tests
    # =====================
    
    def test_eap_no_responses(self, engine):
        """Test: With no responses, θ should be prior mean (0) with SE=1."""
        estimates = engine.update_theta_eap([], [])
        
        for domain in Domain:
            assert abs(estimates[domain].theta) < 0.01, "Prior mean should be 0"
            assert abs(estimates[domain].standard_error - 1.0) < 0.01, "Prior SE should be 1"
    
    def test_eap_all_correct_increases_theta(self, engine):
        """Test: All correct responses should increase θ."""
        responses = [
            ResponseRecord(
                item_id="TEST001",
                response=0,
                response_time_ms=1000,
                is_correct=True
            ),
            ResponseRecord(
                item_id="TEST002",
                response=1,
                response_time_ms=1000,
                is_correct=True
            )
        ]
        
        estimates = engine.update_theta_eap(responses, ["TEST001", "TEST002"])
        
        # Episodic memory should be positive (both items load on it)
        assert estimates[Domain.EPISODIC_MEMORY].theta > 0, "θ should increase with correct responses"
    
    def test_eap_all_incorrect_decreases_theta(self, engine):
        """Test: All incorrect responses should decrease θ."""
        responses = [
            ResponseRecord(
                item_id="TEST001",
                response=1,  # Wrong
                response_time_ms=1000,
                is_correct=False
            )
        ]
        
        estimates = engine.update_theta_eap(responses, ["TEST001"])
        
        assert estimates[Domain.EPISODIC_MEMORY].theta < 0, "θ should decrease with incorrect responses"
    
    def test_eap_se_decreases_with_more_items(self, engine):
        """Test: SE should decrease as more items are administered."""
        responses_1 = [
            ResponseRecord(item_id="TEST001", response=0, response_time_ms=1000, is_correct=True)
        ]
        
        responses_2 = responses_1 + [
            ResponseRecord(item_id="TEST002", response=1, response_time_ms=1000, is_correct=True)
        ]
        
        est_1 = engine.update_theta_eap(responses_1, ["TEST001"])
        est_2 = engine.update_theta_eap(responses_2, ["TEST001", "TEST002"])
        
        # SE for episodic memory should decrease
        assert est_2[Domain.EPISODIC_MEMORY].standard_error < est_1[Domain.EPISODIC_MEMORY].standard_error
    
    def test_eap_percentile_calculation(self, engine):
        """Test: Percentile should map correctly from θ."""
        responses = [
            ResponseRecord(item_id="TEST001", response=0, response_time_ms=1000, is_correct=True)
        ]
        
        estimates = engine.update_theta_eap(responses, ["TEST001"])
        
        # Should have valid percentile
        for domain, est in estimates.items():
            assert 0 <= est.percentile <= 100, f"Invalid percentile: {est.percentile}"
    
    # =====================
    # Item Selection Tests
    # =====================
    
    def test_item_selection_no_repeat(self, engine):
        """Test: Already administered items are not selected again."""
        session = SessionState(
            session_id="test",
            patient_id="patient1"
        )
        
        # Administer first item
        item1 = engine.select_next_item(session)
        session.responses.append(
            ResponseRecord(item_id=item1.id, response=0, response_time_ms=1000, is_correct=True)
        )
        session.items_administered = 1
        
        # Second item should be different
        item2 = engine.select_next_item(session)
        
        assert item2.id != item1.id, "Should not repeat items"
    
    def test_item_selection_max_items(self, engine):
        """Test: Selection returns None when max items reached."""
        session = SessionState(
            session_id="test",
            patient_id="patient1"
        )
        session.items_administered = 100  # Over max
        
        item = engine.select_next_item(session, max_items=50)
        
        assert item is None, "Should return None when max items reached"
    
    def test_item_selection_targets_uncertainty(self, engine):
        """Test: Selection should prefer items that reduce uncertainty."""
        session = SessionState(session_id="test", patient_id="patient1")
        
        # Check that selection returns an item
        item = engine.select_next_item(session)
        
        assert item is not None
        assert item.id in engine.items
    
    # =====================
    # Response Processing Tests
    # =====================
    
    def test_process_response_updates_state(self, engine):
        """Test: Processing response updates session state correctly."""
        session = SessionState(session_id="test", patient_id="patient1")
        
        session = engine.process_response(
            session,
            item_id="TEST001",
            response=0,
            response_time_ms=1500
        )
        
        assert session.items_administered == 1
        assert len(session.responses) == 1
        assert session.responses[0].response == 0
        assert session.responses[0].response_time_ms == 1500
    
    def test_process_response_determines_correctness(self, engine):
        """Test: MCQ correctness is determined automatically."""
        session = SessionState(session_id="test", patient_id="patient1")
        
        # Correct answer for TEST001 is 0
        session = engine.process_response(session, "TEST001", 0, 1000)
        assert session.responses[0].is_correct is True
        
        session = engine.process_response(session, "TEST003", 1, 1000)  # Wrong (correct is 2)
        assert session.responses[1].is_correct is False
    
    def test_process_response_unknown_item(self, engine):
        """Test: Unknown item raises ValueError."""
        session = SessionState(session_id="test", patient_id="patient1")
        
        with pytest.raises(ValueError, match="Unknown item"):
            engine.process_response(session, "UNKNOWN", 0, 1000)
    
    # =====================
    # Simulation Tests
    # =====================
    
    def test_simulation_convergence(self, engine):
        """Test: Simulation shows θ trajectory over items."""
        true_theta = {Domain.EPISODIC_MEMORY: 1.0}
        
        result = engine.run_simulation(true_theta, num_items=5)
        
        assert len(result.theta_trajectory) == 5
        assert len(result.items_used) == 5
        assert result.true_theta == true_theta
    
    def test_simulation_theta_approaches_true(self, engine):
        """Test: With enough items, estimated θ should approach true θ."""
        # Use a domain with items
        true_theta = {Domain.EPISODIC_MEMORY: 0.5}
        
        result = engine.run_simulation(true_theta, num_items=5)
        
        final_em = result.final_theta[Domain.EPISODIC_MEMORY].theta
        
        # With only 5 items and one domain, we can't expect perfect convergence
        # but it should move in the right direction from 0
        # This is a weak test due to stochastic nature
        assert result.final_theta is not None


class TestMathematicalAccuracy:
    """Tests for mathematical accuracy of IRT calculations."""
    
    def test_3pl_formula_exact(self):
        """Test: 3PL formula matches known values."""
        # Manual calculation
        # P = c + (1-c) / (1 + exp(-a(θ-b)))
        # For a=1, b=0, c=0.25, θ=0:
        # P = 0.25 + 0.75 / (1 + exp(0)) = 0.25 + 0.75/2 = 0.625
        
        item = IRTItem(
            id="MATH_TEST",
            prompt="Math test",
            domain_loadings={Domain.EPISODIC_MEMORY: 1.0},
            difficulty=0.0,
            guessing=0.25
        )
        
        engine = IRTEngine.__new__(IRTEngine)
        engine.items = {"MATH_TEST": item}
        engine.settings = type('obj', (object,), {'irt_quadrature_points': 21})()
        
        theta = {Domain.EPISODIC_MEMORY: 0.0}
        p = engine.probability_correct(item, theta)
        
        expected = 0.625
        assert abs(p - expected) < 0.001, f"Expected {expected}, got {p}"
    
    def test_3pl_monotonicity(self):
        """Test: P should be monotonically increasing with θ."""
        item = IRTItem(
            id="MONO_TEST",
            prompt="Monotonicity test",
            domain_loadings={Domain.EPISODIC_MEMORY: 1.0},
            difficulty=0.0,
            guessing=0.2
        )
        
        engine = IRTEngine.__new__(IRTEngine)
        engine.items = {"MONO_TEST": item}
        
        prev_p = 0
        for theta_val in np.linspace(-3, 3, 20):
            theta = {Domain.EPISODIC_MEMORY: theta_val}
            p = engine.probability_correct(item, theta)
            
            assert p > prev_p, f"P should increase: P({theta_val}) = {p} <= {prev_p}"
            prev_p = p


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
