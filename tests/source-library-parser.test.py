"""Regression tests for losing context, even exercises, tables or licenses."""
import importlib.util, pathlib, unittest
spec=importlib.util.spec_from_file_location('source_import',pathlib.Path(__file__).parents[1]/'scripts/import-source-library.py')
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)

class ImportTests(unittest.TestCase):
    def page(self,body,footer='CC BY  4.0'):
        return module.extract('<h1>Test</h1><section class="mt-content-container">'+body+'</section><p>This page is shared under a '+footer+' license</p>','https://math.libretexts.org/book/page')
    def test_even_and_odd_and_common_condition(self):
        p=self.page('<p>Find the least common multiple.</p><div class="box-exercise"><p>1. 6 and 8</p><dl><dt>Answer</dt><dd>24</dd></dl></div><div class="box-example"><p>2. 3 and 5</p></div>')
        self.assertEqual(len(p['exercises']),2)
        self.assertEqual(p['exercises'][0]['sourceAnswers'],['24'])
        self.assertNotIn('24',p['exercises'][0]['prompt'])
        self.assertIn('least common multiple',p['exercises'][1]['context'])
        self.assertEqual(p['license'],'CC BY 4.0')
    def test_ordered_lists_keep_number_and_subparts(self):
        p=self.page('<p>Solve each equation.</p><ol start="7"><li>x+1=2<ol><li>Check the root.</li></ol></li><li>x+2=5</li></ol>')
        self.assertEqual([e['sourceNumber'] for e in p['exercises']],['7','8'])
        self.assertIn('Check the root',p['exercises'][0]['original'])
    def test_full_section_preserves_tables_and_unmarked_exercise(self):
        p=self.page('<p>Compute the mean.</p><table><tr><td>1</td><td>23</td></tr><tr><td>4</td><td>5</td></tr></table><p>Unnumbered question?</p><img src="/image.svg" alt="Triangle with sides 3, 4, 5"><script>alert(1)</script>')
        self.assertIn('1\t23',p['originalText']);self.assertIn('Unnumbered question?',p['originalText'])
        self.assertNotIn('alert(1)',p['originalText']);self.assertEqual(p['figures'][0]['alt'],'Triangle with sides 3, 4, 5')
    def test_restricted_child_license_never_inherits_permissive_root(self):
        root={'url':'https://example.org/book','license':'CC BY 4.0'}
        chapter={'url':'https://example.org/book/chapter','license':'CC BY-NC-SA 4.0'}
        page={'url':'https://example.org/book/chapter/exercises','license':None}
        self.assertEqual(module.inherited_license(page,[root,chapter,page])[0],'CC BY-NC-SA 4.0')
        self.assertEqual(self.page('text','CC BY-NC-SA 4.0')['license'],'CC BY-NC-SA 4.0')
        self.assertIsNone(self.page('text','not declared')['license'])
    def test_equivalent_urls_share_identity(self):
        self.assertEqual(module.canonical('https://example.org/B%3A_One/#test'),module.canonical('https://example.org/B:_One'))
    def test_exponents_list_numbers_and_reference_links_survive(self):
        p=self.page('<ol start="19"><li>x<sup>2</sup> + a<sub>1</sub></li><li>See <a href="https://example.org/data">data table</a></li></ol>')
        self.assertIn('19. x^(2) + a_(1)',p['originalText'])
        self.assertIn('20. See',p['originalText'])
        self.assertEqual(p['references'][0]['url'],'https://example.org/data')
    def test_mathml_is_not_duplicated_and_keeps_fraction_structure(self):
        p=self.page('<div data-type="exercise">12.<p><math><semantics><mfrac><msup><mi>x</mi><mn>2</mn></msup><mn>3</mn></mfrac><annotation-xml><mi>duplicate</mi></annotation-xml></semantics></math></p><div data-type="solution">Answer: 4</div></div>')
        self.assertEqual(len(p['exercises']),1)
        self.assertIn('\\frac{{x}^{2}}{3}',p['exercises'][0]['prompt'])
        self.assertNotIn('duplicate',p['originalText'])
        self.assertNotIn('Answer: 4',p['exercises'][0]['prompt'])
    def test_sibling_answer_list_is_not_a_question_or_shared_instruction(self):
        p=self.page('<p>In the following exercises, simplify.</p><p>1. \\(2+3\\)</p><dl><dt>Answer</dt><dd><p>5</p><ol><li>42</li></ol></dd></dl><p>2. \\(3+4\\)</p>')
        self.assertEqual(len(p['exercises']),2)
        self.assertEqual(p['exercises'][1]['context'],'In the following exercises, simplify.')
    def test_unrecognised_mathml_cannot_silently_become_different_arithmetic(self):
        p=self.page('<div data-type="exercise">1.<math><menclose notation="radical"><mn>4</mn></menclose></math></div>')
        self.assertIn('\\unsupported{menclose}',p['exercises'][0]['prompt'])

if __name__=='__main__': unittest.main()
